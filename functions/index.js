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

// Funcion que permite verificar el token de firebase
async function verifyFirebaseToken(idToken) {
    await admin.auth().verifyIdToken(idToken)
    .then(function(decodedToken) {
        return decodedToken;
    }).catch(function(error) {
        return null;
    });
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
    let objRes = {'status':false, 'message':'', 'data':{}};

    const accessToken = req.body.accessToken;
    const imageBase64 = req.body.imageBase64;
    const nic = req.body.nic;

    if (req.method == 'POST') {
        const objFb = verifyFirebaseToken();
        if( objFb != null ){
            const dbRef = admin.database().ref('/registros')
            const message = {
                usuario: objFb.uid,
                nic: nic,
                fecha: (new Date).toString(),
            }
            dbRef.push(message)
                .then(dat => res.json({'id':dat.getKey()}))
                .catch(err => res.json(err))
        } else {
            objRes.message = 'Token inválido';
        }
    } else {
        objRes.message = 'Método no permitido';
    }
    res.json(objRes);
});