
// Todo make this a proper NodeJS module

function DCLOCAL() {

  this.storeData = new Array();

  this.getDid = function (pkey) {
    return 'did:discipl:local'+getHash(pkey, 'did:discipl');
  }

  this.claim = function (obj, pkey) {
    var did = this.getDid(pkey);
    if(!this.storeData[did]) {
      this.storeData[did] = new Array();
    }
    var index = this.storeData[did].length;
    this.storeData[did][index] = obj;
    return index;
  }

  this.attest = function (obj, pkey, hashkey) {
    // Todo add did as subject (the attestor making the attestation claim)
    return this.claim(CryptoJS.HmacSHA384(obj,hashkey),pkey);
  }

  this.verify = function (obj, attestor_did, hashkey) {
    var hash = CryptoJS.HmacSHA384(obj,hashkey);
    var attestation = this.getByReference(obj, attestor_did);
    return hash == attestation;
  }

  this.getByReference = function (ref, did) {
    return this.storeData[did][ref];
  }

}
