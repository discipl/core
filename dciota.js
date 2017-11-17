var CryptoJS = require('crypto-js');
var Mam = require('../mam.client.js/lib/mam.node.js');
var IOTA = require('iota.lib.js');

var iota = null;
var mamState = null;

const setIOTANode = (iotaNodeUrl) => {
    iota = new IOTA({ provider: iotaNodeUrl });
}

const getDid = (pkey) => {
    if(iota == null) {
      throw "Discipl Core - IOTA binding : no IOTA node is set to connect to";
    }
    // check channel existence and if it does not exist, create it
    if(mamState == null || mamState.seed != pkey)  {
      if(pkey.length != 81) {
        throw "Discipl Core - IOTA binding : private key must be a valid IOTA seed";
      }
      mamState = Mam.init(iota, pkey, 2);
    }
    return 'did:discipl:iota'+Mam.getRoot(mamState);
}

const claim = async (obj, pkey) => {
    var did = getDid(pkey);
    var trytes = iota.utils.toTrytes(JSON.stringify(obj));
    var message = Mam.create(mamState, trytes);
    mamState = message.state;
    await Mam.attach(message.payload, message.address);
    return message.root;
}

const attest = async (obj, pkey, hashkey) => {
    var attesthash =  CryptoJS.HmacSHA384(obj,hashkey).toString(CryptoJS.enc.latin1);
    return claim(attesthash,pkey);
}

const verify = async (ref, attestor_did, obj, hashkey) => {
    var hash = CryptoJS.HmacSHA384(obj,hashkey).toString(CryptoJS.enc.latin1);
    var attestation = await getByReference(ref, attestor_did);
    return hash == attestation;
}

  //this.revoke

const getByReference = async (ref, did) => {
    var obj = null;
    if(mamState == null) {
      mamState = Mam.init(iota);
    }
    await Mam.fetch(ref, 'public', null, function (data) {
      obj = JSON.parse(iota.utils.fromTrytes(data));
    });
    return obj;
}


module.exports = {
  setIOTANode,
  getDid,
  claim,
  attest,
  verify,
  getByReference
}
