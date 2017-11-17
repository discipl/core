var CryptoJS = require('crypto-js');

var storeData = new Array();

const getDid = (pkey) => {
  return 'did:discipl:local'+CryptoJS.HmacSHA384(pkey, 'did:discipl').toString(CryptoJS.enc.latin1);
}

const claim = (obj, pkey) => {
  var did = getDid(pkey);
  if(!storeData[did]) {
    storeData[did] = new Array();
  }
  var index = CryptoJS.lib.WordArray.random(64);
  storeData[did][index] = obj;
  return index;
}

const attest = (obj, pkey, hashkey) => {
    // Todo add did as subject (the attestor making the attestation claim)
    return claim(CryptoJS.HmacSHA384(obj,hashkey).toString(CryptoJS.enc.latin1),pkey);
}

const verify = (ref, attestor_did, obj, hashkey) => {
    var hash = CryptoJS.HmacSHA384(obj,hashkey).toString(CryptoJS.enc.latin1);
    var attestation = getByReference(ref, attestor_did);
    return hash == attestation;
}

  // this.revoke

const getByReference = (ref, did) => {
    return storeData[did][ref];
}

module.exports = {
  getDid,
  claim,
  attest,
  verify,
  getByReference
}
