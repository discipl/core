const CryptoJS = require('crypto-js')
const BaseConnector = require('./base-connector.js')
const debug = require('debug')('dciota');

module.exports = class IotaConnector extends BaseConnector {

  constructor(Mam, iota) {
    super()
    this.Mam = Mam
    this.iota = iota

    // TODO: This is suboptimal, but it's a workaround for this: https://github.com/l3wi/mam.client.js/pull/2
    this.Mam.init(this.iota, '999999999999999999999999999999999999999999999999999999999999999999999999999999999', 2)
  }

  serialize(mamState) {
    return JSON.stringify(mamState)
  }

  deserialize(mamState) {
    return JSON.parse(mamState)
  }

  initState(initData) {
    var mamState = this.Mam.init(this.iota, initData, 2)
    return mamState
  }

  getDid(mamState) {
    var root = this.Mam.getRoot(mamState);
    return 'did:discipl:iota' + root;
  }

  async claim(mamState, data) {
    var trytes = this.iota.utils.toTrytes(JSON.stringify(data));
    console.log(mamState);
    var message = this.Mam.create(mamState, trytes);
    mamState = message.state;
    await this.Mam.attach(message.payload, message.address);
    return {
      mamState,
      root: message.root
    };
  }

  async getByReference(ref) {
    var obj = null;
    var resp = await this.Mam.fetchSingle(ref, 'public', null);
    obj = JSON.parse(this.iota.utils.fromTrytes(resp.payload));
    return obj;
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
        resp = await this.Mam.fetchSingle(resp.nextRoot, 'public', null);
      } catch (e) {
        return false;
      };
    }
    return false;
  }

  attest(mamState, data, hashKey) {
    var attesthash = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA384(data, hashKey))
    return this.claim(mamState, data)
  }

  async verify(ref, attestorDid, data, hashKey) {
    debug('obj: ' + data + ' ' + data.length);
    debug('obj: ' + hashKey + ' ' + hashKey.length);
    var hash = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA384(data, hashKey));
    var attestation = await getByReference(ref, attestorDid);
    debug(hash + ' == ' + attestation);
    var found = await findRefInChannel(attestorDid, ref);
    debug('Found in attestor channel: ' + found);
    return found && (hash == attestation);
  }

}
