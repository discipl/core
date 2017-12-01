const debug =  require('debug')('dciota');
var CryptoJS = require('crypto-js');
var Mam = require('../mam.client.js/lib/mam.node.js');
var IOTA = require('iota.lib.js');
var fs = require('fs');

var iota = null;
var mamState = null;
var root = null;

const setIOTANode = (iotaNodeUrl) => {
  iota = new IOTA({
    provider: iotaNodeUrl
  });
}

const setState = (stateStr) => {
  mamState = JSON.parse(stateStr);
}

const getState = () => {
  return JSON.stringify(mamState);
}

const getDid = (pkey) => {
  if (iota == null) {
    throw "Discipl Core - IOTA binding : no IOTA node is set to connect to";
  }

  var ms = Mam.init(iota, pkey, 2);
  root = Mam.getRoot(ms);

  // if no mamState is set or belonging to different seed, reset to root
  if (mamState == null || mamState.seed != pkey) {
    if (pkey.length != 81) {
      throw "Discipl Core - IOTA binding : private key must be a valid IOTA seed";
    }
    mamState = ms;
  }

  return 'did:discipl:iota' + root;
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
  debug('obj: ' + obj + ' ' + obj.length);
  debug('obj: ' + hashkey + ' ' + hashkey.length);
  var attesthash = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA384(obj, hashkey));
  debug('attesthash: ' + attesthash);
  return claim(attesthash, pkey);
}

const verify = async (ref, attestor_did, obj, hashkey) => {
  debug('obj: ' + obj + ' ' + obj.length);
  debug('obj: ' + hashkey + ' ' + hashkey.length);
  var hash = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA384(obj, hashkey));
  var attestation = await getByReference(ref, attestor_did);
  debug(hash + ' == ' + attestation);
  var found = await findRefInChannel(attestor_did, ref);
  debug('Found in attestor channel: ' + found);
  return found && (hash == attestation);
}

//this.revoke

const getByReference = async (ref, did) => {
  var obj = null;
  if (mamState == null) {
    mamState = Mam.init(iota);
  }
  var resp = await Mam.fetchSingle(ref, 'public', null);
  obj = JSON.parse(iota.utils.fromTrytes(resp.payload));
  return obj;
}

const findRefInChannel = async (did, ref) => {
  if (mamState == null) {
    mamState = Mam.init(iota);
  }
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

module.exports = {
  setIOTANode,
  getState,
  setState,
  getDid,
  claim,
  attest,
  verify,
  getByReference
}
