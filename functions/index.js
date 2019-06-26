const cors = require('cors')({origin: true});
const functions = require('firebase-functions');

var firebaseConfig = {
    apiKey: "AIzaSyCve6GO6hHRETXT_SVGn_PoZiJ0vD9-dUM",
    authDomain: "summa-celsia.firebaseapp.com",
    databaseURL: "https://summa-celsia.firebaseio.com",
    projectId: "summa-celsia",
    storageBucket: "summa-celsia.appspot.com",
    messagingSenderId: "307098320551",
    appId: "1:307098320551:web:ee33005ce1cc070f"
};

// Initialize Firebase
const firebase = require('firebase');
firebase.initializeApp(firebaseConfig);
// Initialize Firebase Admin
const admin = require('firebase-admin');
admin.initializeApp();


///// UTILS /////

// Prototipo que permite buscar un obj dentro de un array de objetos
Array.prototype.findUserBy = function (nameKey, value) {
    for (var i=0; i<this.length; i++) {
        var object = this[i];
        if (nameKey in object && object[nameKey] === value) {
            return object;
        }
    }
    return null;
}

// Funcion que permite validar un usuario
function validateUser(userName, userPass) {
    let userList = [
        {'userName': 'dnorena', 'userPass': 'Dn12345', 'NIC':['1005001']},
        {'userName': 'aalzateal', 'userPass': 'Aa12345', 'NIC':['1005002', '11005003']},
        {'userName': 'cescobars', 'userPass': 'Ce12345', 'NIC':['1005004']},
        {'userName': 'ecampo', 'userPass': 'Ec12345', 'NIC':['1005005']},
    ];

    let userFind = userList.findUserBy('userName', userName);
    if(userFind!=null && userFind.userPass === userPass) {
        return userFind;
    }
    return null;
}


///// HANDLERS REQUESTS /////

// Firebase Function que permite el login
exports.customLogin = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
    
        let objRes = {'status':false, 'message':'', 'data':{}};

        if( req.method == 'POST') {
            const userName = req.body.userName;
            const userPass = req.body.userPass;

            const userFind = validateUser(userName, userPass);
            if( userFind != null ) {

                // Creacion de token AIM
                //let uid = 'custom-uid-' + userName;
                let uid = userName;
                const aimToken = await admin.auth().createCustomToken(uid)
                .then(function(customToken) {
                    return customToken;
                }).catch(function(error) {
                    objRes.message = 'Error de AIM';
                    objRes.data = error;
                    res.json(objRes);
                });

                const fbToken = await firebase.auth().signInWithCustomToken(aimToken)
                .then(function(data) {
                    return data;
                })
                .catch(function(err) {
                    objRes.message = 'Error de Firebase';
                    objRes.data = err;
                    res.json(objRes);
                });

                objRes.status = true;
                objRes.message = 'Autenticación exitosa';
                objRes.data.userFind = userFind;
                objRes.data.fb = fbToken;

            } else {
                objRes.message = 'Error de credenciales';
            }
            
        } else {
            objRes.message = 'Método no permitido';
        }
        res.json(objRes);
    });
});

// Firebase Function que permite guardar los datos del formulario de registro del medidor
exports.recordData = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {

        let objRes = {'status':false, 'message':'', 'data':{}};

        if (req.method == 'POST') {
            const accessToken = req.body.accessToken;
            //const imageBase64 = req.body.imageBase64.split(',')[1];
            const imageBase64 = req.body.imageBase64;
            const nic = req.body.nic;

            const objFb = await admin.auth().verifyIdToken(accessToken)
            .then(function(decodedToken) {
                return decodedToken;
            }).catch(function(error) {
                return null;
            });

            if( objFb != null ){
                // Guardar imagen en storage cloud
                let today = new Date();
                let dd = ("0" + today.getDate()).slice(-2);
                let mm = ("0" + (today.getMonth() + 1)).slice(-2);
                let yyyy = today.getFullYear();
                const imgName = dd+'-'+mm+'-'+yyyy+'_'+nic;

                var mimeType = 'image/jpeg',
                    imageBuffer = new Buffer(imageBase64, 'base64');

                var bucket = admin.storage().bucket();
                var file = bucket.file('img/' + imgName +'.jpg');
                await file.save(imageBuffer, {
                    metadata: { contentType: mimeType },
                }, ((error) => {
                    if (error) {
                        objRes.message = 'Error storage bucket';
                        objRes.data = error;
                    }
                }));

                let linkImage = await file.getSignedUrl({
                    action: 'read',
                    expires: '01-01-2491'
                }).then(function(signedUrls) {
                    console.log('DEB URL: ', signedUrls);
                    return signedUrls[0];
                });

                // Guardar en Firebase Realtime Database
                const dbRef = admin.database().ref('/registros')
                const message = {
                    usuario: objFb.uid,
                    nic: nic,
                    fecha: (new Date).toString(),
                    image: linkImage,
                }

                const fbSave = await dbRef.push(message)
                .then(function(dat) {
                    return dat;
                }).catch(function(err) {
                    return null;
                });

                if(fbSave) {
                    objRes.status = true;
                    objRes.message = 'Información almacenada correctamente';
                    objRes.data = {
                        'idFbDb':fbSave.getKey()
                    }
                } else {
                    objRes.message = 'Error de storage bucket';
                }

                // Guardar en sharepoint
                console.log('INIT SP');
                var http = require('http');  
                var spauth = require('node-sp-auth');  
                var requestprom = require('request-promise');

                var url = 'https://celsia.sharepoint.com/sites/SummaDev/';  
                var username = "dnorena@celsia.com";  
                var password = "Celsi@poc2019";

                // Authenticate with hardcoded credentials  
                spauth.getAuth(url, {          
                    username:username,  
                    password:password  
                })  
                .then(function(options){  
                    // Headers  
                    var headers = options.headers; 
                    
                    console.log(options.headers);
                    
                    headers['accept'] = 'application/json;odata=verbose';  
                    headers['content-Type'] = 'application/json;odata=verbose';
                    headers['x-requestdigest'] = '0x3668CCEF40574B0B213ECE3EDBFDAE097D5ED0A1A2972DB4ECBAB398F1F556B10D3C10475BC131ECB8552646A898EF73C6CE55B79DE2B0C97DE595B218AD71E2,26 Jun 2019 22:38:54 -0000';

                    // Pull the SharePoint list items  
                    requestprom.post({ 
                    url: url + "/_api/web/lists/getByTitle('RevisionMedidorPragma')/items",
                        //body: { '__metadata': { 'type': 'SP.Data.RevisionMedidorPragmaListItem' }, 'Title': 'pragma', 'Usuario':message.usuario, 'NIC' : message.nic, 'img': {'__metadata': { 'type': 'SP.FieldUrlValue' },'Description': 'Foto','Url': encodeURI(message.image)} },
                        body: { '__metadata': { 'type': 'SP.Data.RevisionMedidorPragmaListItem' }, 'Title': 'pragma', 'Usuario':message.usuario, 'NIC' : message.nic, 'img': {'__metadata': { 'type': 'SP.FieldUrlValue' },'Description': 'Foto','Url': 'https://eficienciaenergetica.celsia.com/hs-fs/hubfs/celsia-logo-corporativo.png?width=379&name=celsia-logo-corporativo.png'} },
                        headers: headers,  
                        json: true  

                    }).then(function(response){
                        console.log('DEB SP respon:', response); 
                    }).catch(function(err) {
                        console.log('DEB SP ERROR:', err); 
                    });
                }).catch(function(err) {
                    console.log('DEB SP AUTH ERROR:', err); 
                });

                
            } else {
                objRes.message = 'Token inválido';
            }
        } else {
            objRes.message = 'Método no permitido';
        }
        res.json(objRes);
    });
});

