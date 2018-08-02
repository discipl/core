
let vows = require('vows')
let assert = require('assert')
let rewire = require("rewire")
let discipl = rewire('../index.js')
let tmpSsid = null
let tmpAttestorSsid = null
let tmpAttestorSsid2 = null
let tmpLink = null
let tmpLink2 = null
let tmpAttestLink = null
let suite = vows.describe('discipl-core-api').addBatch({
  'A Discipl Core API synchronously ' : {
    'can load a connector module like discipl-core-memory' : {
      topic : 'memory',
      'once when needed and retrieve it' : function (topic) {
        assert.equal(discipl.getConnector(topic).getName(), topic)
      },
      'and retrieve it multiple times' : function (topic) {
        assert.equal(discipl.getConnector(topic).getName(), topic)
      }
    },
    'can be used to get links ' : {
      topic : {'connector':discipl.getConnector('memory'),'did':'IN33DB33R'},
      ' internally from a ssid and claim reference (a string) ' : function (topic) {
        assert.equal(discipl.__get__('getLink')(topic,'123456789'),'link:discipl:memory:123456789')
      },
      ' internally from a ssid and claim (JSON) ' : function (topic) {
        assert.equal(discipl.__get__('getLink')(topic,{'need':'beer'}),'link:discipl:memory:xF5Q7KbSEwork2sDv4UZvxtWORyLNfsBCit4dQq3/6k0tjeKDoP/s9oD6A+OOYSg')
      },
      ' internally though null objects as claim will resolve as a null value as link' : function (topic) {
        assert.equal(discipl.__get__('getLink')(topic, null), null)
      }
    },
    'can use discipl links like: link:discipl:memory:1234 ' : {
      topic : 'link:discipl:memory:1234',
      'internally to obtain the connector name and reference from the link ' : function (topic) {
        assert.equal(JSON.stringify(discipl.__get__('splitLink')(topic)), JSON.stringify({'connector':'memory','reference':'1234'}))
      },
      'internally to check if they are valid ' : function (topic) {
        assert.equal(discipl.__get__('isValidLink')(topic), true)
      },
      'internally to check if they are syntactically invalid ' : function (topic) {
        assert.equal(discipl.__get__('isValidLink')(topic.replace(':','.')), false)
      },
      'internally to check if they are semantically invalid (the connector name part) ' : function (topic) {
        assert.equal(discipl.__get__('isValidLink')(topic.replace('memory','discipl-core')), false)
      }
    },
  }
}).addBatch({
  'A Discipl Core API asynchronously can retrieve a new ssid' : {
      topic : function () {
        vows = this
        discipl.newSsid('memory').then(function (res) {
          tmpSsid = res
          vows.callback(null, res)
        }).catch(function (err) {
          vows.callback(err, null)
        })
      },
      ' returns a proper ssid object with different large random strings as keys, a did and connector object' : function (err, ssid) {
        assert.equal(err, null)
        assert.equal(typeof ssid.pubkey, 'string')
        assert.equal(ssid.pubkey.length , 88)
        assert.equal(typeof ssid.privkey, 'string')
        assert.equal(ssid.privkey.length, 88)
        assert.notEqual(ssid.pubkey, ssid.privkey)
        assert.equal(tmpSsid, ssid)
        assert.equal(ssid.did, 'did:discipl:memory:'+ssid.pubkey)
        assert.equal(ssid.connector.getName(), 'memory')
      },
    }
}).addBatch({
  'A Discipl Core API asynchronously can add a first claim to some new channel through a claim() method which' : {
    topic : function () {
      vows = this
      discipl.claim(tmpSsid, {'need':'beer'}).then(function (res) {
        tmpLink = res
        vows.callback(null, res)
      }).catch(function (err) {
        vows.callback(err, null)
      })
    },
    ' returns a valid link to the claim' : function (err, link) {
        assert.equal(err, null)
        assert.equal(typeof link, 'string')
        assert.equal(link.length , 108)
        assert.equal(tmpLink, link)
        assert.equal(discipl.__get__('isValidLink')(link), true)
    }
  }}).addBatch({
  'A Discipl Core API asynchronously can retrieve a first claim that is referenced in a link given to a get() method which' : {
    topic : function () {
      vows = this
      discipl.get(tmpLink).then(function (res) {
        vows.callback(null, res)
      }).catch(function (err) {
        vows.callback(err, null)
      })
    },
    ' returns a result object with the data and a link to the previous claim in the channel that equals null if it is the first claim in the channel' : function (err, res) {
        assert.equal(err, null)
        assert.equal(JSON.stringify(res.data), JSON.stringify({'need':'beer'}))
        assert.equal(res.previous, null)
    }
  }}).addBatch({
  'A Discipl Core API asynchronously can add another claim to some existing channel through a claim() method which' : {
    topic : function () {
      vows = this
      discipl.claim(tmpSsid, {'need':'u'}).then(function (res) {
        tmpLink2 = res
        vows.callback(null, res)
      }).catch(function (err) {
        vows.callback(err, null)
      })
    },
    ' returns a reference to the claim' : function (err, link) {
        assert.equal(err, null)
        assert.equal(typeof link, 'string')
        assert.equal(link.length , 108)
        assert.equal(tmpLink2, link)
    }
  }}).addBatch({
  'A Discipl Core API asynchronously can retrieve a second claim that is referenced in a link given to a get() method which' : {
    topic : function () {
      vows = this
      discipl.get(tmpLink2).then(function (res) {
        vows.callback(null, res)
      }).catch(function (err) {
        vows.callback(err, null)
      })
    },
    ' returns a result object with the data and a link to the previous (first) claim' : function (err, res) {
        assert.equal(err, null)
        assert.equal(JSON.stringify(res.data), JSON.stringify({'need':'u'}))
        assert.equal(res.previous, tmpLink)
    }
  }}).addBatch({
  'A Discipl Core API asynchronously can attest a second claim in a channel in a new other channel through an attest() method which' : {
    topic : function () {
      vows = this
      discipl.newSsid('memory').then(function (res) {
        tmpAttestorSsid = res
        discipl.attest(res, 'agree', tmpLink2).then(function (res) {
          tmpAttestLink = res
          discipl.get(res).then(function (res) {
            vows.callback(null, res)
          })
        })
      }).catch(function (err) { vows.callback(err, null) })
    },
    ' returns the link to the attestation with which the attestation can be retrieved ' : function (err, res) {
        assert.equal(err, null)
        assert.equal(JSON.stringify(res.data), JSON.stringify({'agree':tmpLink2}))
        assert.equal(res.previous, null)
    }
  }
}).addBatch({
  'A Discipl Core API asynchronously can verify whether a claim has been attested' : {
    topic : function () {
      vows = this
      discipl.verify('agree', tmpLink2, [tmpSsid, tmpAttestorSsid2, {'did':'did:discipl:memory:1234'}, tmpAttestorSsid]).then(function (res) {
        vows.callback(null, res)
      }).catch(function (err) { vows.callback(err, null) })
    },
    ' verify() returns ssid of first attesttor in the given list and does not throw error on given null or non existing ssids' : function (err, res) {
        assert.equal(err, null)
        assert.equal(res, tmpAttestorSsid)
    }
  }}).addBatch({
  'A Discipl Core API asynchronously can verify whether a claim has not been attested' : {
    topic : function () {
      vows = this
      discipl.verify('disagree', tmpLink2, [tmpSsid, tmpAttestorSsid2, {'did':'did:discipl:memory:1234'}, tmpAttestorSsid]).then(function (res) {
        vows.callback(null, res)
      }).catch(function (err) { vows.callback(err, null) })
    },
    ' verify() returns null and does not throw error on given null or non existing ssids' : function (err, res) {
        assert.equal(err, null)
        assert.equal(res, null)
    }
  }}).addBatch({
  'A Discipl Core API asynchronously can export linked verifiable claim channels ' : {
    topic : function () {
      vows = this
      discipl.exportLD(tmpAttestorSsid).then(function (res) {
        vows.callback(null, res)
      }).catch(function (err) { vows.callback(err, null) })
    },
    ' verify() returns null and does not throw error on given null or non existing ssids' : function (err, res) {
        assert.equal(err, null)
        assert.equal(JSON.stringify(res[tmpAttestorSsid.did][tmpAttestLink]['agree'][tmpSsid.did][tmpLink2]), JSON.stringify({need:'u'}))
    }
  }
}).export(module)
