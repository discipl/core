var CryptoJS = require('crypto-js');

var storeData = new Array();

const getDid = (pkey) => {
  return 'did:discipl:local'+CryptoJS.HmacSHA384(pkey, 'did:discipl');
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
    return claim(CryptoJS.HmacSHA384(obj,hashkey),pkey);
}

const verify = (obj, attestor_did, hashkey) => {
    var hash = CryptoJS.HmacSHA384(obj,hashkey);
    var attestation = getByReference(obj, attestor_did);
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
