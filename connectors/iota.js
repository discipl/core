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
	await this.Mam.attach(message.payload, message.address)
    return {
      mamState,
      message
    };
  }

  async getByReference(ref) {
    var resp = await this.Mam.fetchSingle(ref, 'public', null);
    return this.iota.utils.fromTrytes(resp.payload);
  }
  
  async exportLD(did) {
	return exportLD(did, {})
  }
  
  async exportLD(did, didStack) {
	var vcdata = {}
	var resp = {
      nextRoot: did.slice(16)
    };
    while (resp) {
      console.log('... ' + resp.nextRoot)
	  
      try {
        resp = await this.Mam.fetchSingle(resp.nextRoot, 'public', null);
      } catch (e) { 
		console.log("Error reading channel : "+e)
		break;
	  };
	  if(resp) {
		var data = this.iota.utils.fromTrytes(resp.payload)
		if(data.slice == 'did:discipl:iota' && !didStack.contains(data)) {
			vcdata[resp.nextroot].did = data
			didStack.push(data)
			vcdata[resp.nextroot].data = await exportLD(data, didStack)
		}
		else {
			vcdata[resp.nextroot] = data
		}
	  } else {
		console.log("End of channel for did: "+did)
	  }
    }
    return vcdata
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
  
  attestHash(data, hashKey) {
	return CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA384(data, hashKey));
  }
  
  attest(mamState, data, hashKey) {
    var attesthash = attestHash(data, hashKey)
    return this.claim(mamState, attesthash)
  }
  
  attestByReference(mamState, ref) {
	var attest = {'attest':ref};
	return this.claim(mamState, JSON.stringify(attest))
  }

  async verifyByRef(ref, attestorDid) {
	// todo:
	// find claim in channel that links to ref as attestation
  }
  
  async verify(ref, attestorDid, data, hashKey) {
    var attestHash = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA384(data, hashKey))
    console.log('obj: ' + data + ' ' + data.length);
    console.log('hashKey: ' + hashKey + ' ' + hashKey.length);
    var attestation = await this.getByReference(ref);
    console.log(attestHash + ' == ' + attestation);
    var found = await this.findRefInChannel(attestorDid, ref);
    debug('Found in attestor channel: ' + found);
    return found && (attestHash === attestation);
  }

}
