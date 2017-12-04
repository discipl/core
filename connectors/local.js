var CryptoJS = require('crypto-js');

module.exports = class LocalConnector extends BaseConnector {

  constructor(iota) {
    super()
  }

  serialize() {
    throw new Error("this function is not used in LocalConnector!")
  }

  deserialize(mamState) {
    throw new Error("this function is not used in LocalConnector!")
  }

  initState(initData) {
    this.storeData = new Array()
  }

  getDid(pkey) {
    return 'did:discipl:local'+CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA384(pkey, 'did:discipl'));
  }

  async claim(obj, pkey) {
    var did = getDid(pkey);
    if(!this.storeData[did]) {
      this.storeData[did] = new Array();
    }
    var index = CryptoJS.enc.Base64.stringify(CryptoJS.lib.WordArray.random(64));
    this.storeData[did][index] = obj;
    return index;
  }

  async getByReference(ref, did) {
      return this.storeData[did][ref];
  }

  async findRefInChannel(did, ref) {
    var resp = {
      nextRoot: did.slice(16)
    };
    while (resp) {
      debug('... ' + resp.nextRoot);
      if (resp.nextRoot == ref) {
        return true;
      }
      try {
        resp = await Mam.fetchSingle(resp.nextRoot, 'public', null);
      } catch (e) {
        return false;
      };
    }
    return false;
  }

  attest(obj, pkey, hashkey) {
      // Todo add did as subject (the attestor making the attestation claim)
      return claim(CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA384(obj,hashkey)),pkey);
  }

  async verify(ref, attestor_did, obj, hashkey) {
      var hash = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA384(obj,hashkey));
      var attestation = getByReference(ref, attestor_did);
      return hash == attestation;
  }

}