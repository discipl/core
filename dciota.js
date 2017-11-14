
// Todo make this a proper NodeJS module

function DCIOTA() {

  this.iota = new IOTA({ provider: iotanode });
  this.mamState = null;

  this.getDid = function (pkey) {
    // check channel existence and if it does not exist, create it
    if(mamState == null || mamState.seed != pkey)  {
      this.mamstate = Mam.init(this.iota, pkey, 2);
    }
    return 'did:discipl:iota'+Mam.getRoot(this.mamstate);
  }

  this.claim = function (obj, pkey) {
    var did = this.getDid(pkey);
    // Todo: add did as subject if non existent otherwise check subject equals did
    var trytes = iota.utils.toTrytes(JSON.stringify(obj));
    var message = Mam.create(this.mamstate, trytes);
    this.mamState = message.state;
    await Mam.attach(message.payload, message.address);
    return message.root;
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

  //this.revoke

  this.getByReference = function (ref, did) {
    var obj = null;
    await Mam.fetch(ref, 'public', null, function (data) {
      msg = JSON.parse(iota.utils.fromTrytes(data));
    });
    return obj;
  }

}
