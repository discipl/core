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
    var trytes = this.iota.utils.toTrytes(data);
    var message = this.Mam.create(mamState, trytes);
    mamState = message.state;
    await this.Mam.attach(message.payload, message.address);
    return {
      mamState,
      root: message.root
    };
  }

  async getByReference(did) {
    var ref = did.slice(16)
    var obj = null;
    var resp = await this.Mam.fetchSingle(ref, 'public', null);
    return this.iota.utils.fromTrytes(resp.payload);
  }

  async findRefInChannel(did) {
    var ref = did.slice(16)
    var resp = {
      nextRoot: ref
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
    return this.claim(mamState, hashKey)
  }

  async verify(ref, attestorDid, data, hashKey) {
    console.log('obj: ' + data + ' ' + data.length);
    console.log('hashKey: ' + hashKey + ' ' + hashKey.length);
    var attestation = await this.getByReference(attestorDid);
    console.log(hashKey + ' == ' + attestation);
    var found = await this.findRefInChannel(attestorDid);
    debug('Found in attestor channel: ' + found);
    return found && (hashKey === attestation);
  }

}
