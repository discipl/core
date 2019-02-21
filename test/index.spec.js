/* eslint-env mocha */
import { expect } from 'chai'
import * as discipl from '../src/index.js'
import { loadConnector } from '../src/connector-loader.js'

import sinon from 'sinon'
import { take, toArray } from 'rxjs/operators'

describe('discipl-core', () => {
  describe('The disciple core API with ephemeral connector', () => {
    it('should be able to get the connector asynchronously', async () => {
      const connector = await discipl.getConnector('ephemeral')
      expect(connector.getName()).to.equal('ephemeral')

      expect(connector.getName(), 'when loaded for the second time').to.equal('ephemeral')
    })

    it('should be able to retrieve a new ssid asynchronously', async () => {
      let ssid = await discipl.newSsid('ephemeral')

      expect(ssid.pubkey).to.be.a('string')
      expect(ssid.privkey).to.be.a('string')
      expect(ssid.pubkey).to.not.equal(ssid.privkey)
      expect(ssid.did).to.equal('did:discipl:ephemeral:' + ssid.pubkey)
      expect(ssid.connector.getName()).to.equal('ephemeral')
    })

    it('should be able to add a first claim to some new channel through a claim() method', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimlink = await discipl.claim(ssid, { 'need': 'beer' })

      expect(claimlink).to.be.a('string')
    })

    it('should be able to get a claim added through claim, with link to previous', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimlink1 = await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let claim = await discipl.get(claimlink2)
      expect(JSON.stringify(claim.data)).to.equal(JSON.stringify({ 'need': 'wine' }))
      expect(claim.previous).to.equal(claimlink1)
    })

    it('should be able to attest to a second claim in a chain', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let attestorSsid = await discipl.newSsid('ephemeral')

      let attestationLink = await discipl.attest(attestorSsid, 'agree', claimlink2)

      let attestation = await discipl.get(attestationLink)

      expect(attestation.data.agree).to.equal(claimlink2)
      expect(attestation.previous).to.equal(null)
    })

    it('should be able to verify an attestation', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let attestorSsid = await discipl.newSsid('ephemeral')

      await discipl.attest(attestorSsid, 'agree', claimlink2)

      let verifiedAttestor = await discipl.verify('agree', claimlink2, [ssid, null, { 'did': 'did:discipl:ephemeral:1234' }, attestorSsid])

      // The first ssid that is valid and proves the attestation should be returned
      expect(verifiedAttestor).to.equal(attestorSsid)
    })

    it('should be able to not verify an attestation of a revoked claim', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let attestorSsid = await discipl.newSsid('ephemeral')

      await discipl.attest(attestorSsid, 'agree', claimlink2)
      await discipl.revoke(ssid, claimlink2)

      let verifiedAttestor = await discipl.verify('agree', claimlink2, [attestorSsid])

      // The first ssid that is valid and proves the attestation should be returned
      // but none such was given so it should not find any matching attestor
      expect(verifiedAttestor).to.equal(null)
    })

    it('be able to observe', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimLink = await discipl.claim(ssid, { 'need': 'beer' })
      let observable = await discipl.observe(ssid)
      let resultPromise = observable.pipe(take(1)).toPromise()
      await discipl.claim(ssid, { 'need': 'wine' })

      let result = await resultPromise

      expect(result).to.deep.equal({
        'claim': {
          'data': {
            'need': 'wine'
          },
          'previous': claimLink
        },
        'ssid': {
          'did': ssid.did
        }
      })
    })

    it('be able to observe platform-wide', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimLink = await discipl.claim(ssid, { 'need': 'beer' })
      let observable = await discipl.observe(null, {}, false, await discipl.getConnector('ephemeral'))
      let resultPromise = observable.pipe(take(1)).toPromise()
      await discipl.claim(ssid, { 'need': 'wine' })

      let result = await resultPromise

      expect(result).to.deep.equal({
        'claim': {
          'data': {
            'need': 'wine'
          },
          'previous': claimLink
        },
        'ssid': {
          'did': ssid.did
        }
      })
    })

    it('be able to observe historically', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimLink = await discipl.claim(ssid, { 'need': 'beer' })
      let observable = await discipl.observe(ssid, null, true)

      await discipl.claim(ssid, { 'need': 'wine' })
      let resultPromise = observable.pipe(take(2)).pipe(toArray()).toPromise()

      let result = await resultPromise

      // Delete the connectors to prevent circular references from messing up testing
      delete result[0].ssid.connector
      delete result[1].ssid.connector

      expect(result).to.deep.equal([
        {
          'claim': {
            'data': {
              'need': 'beer'
            },
            'previous': null
          },
          'ssid': {
            'did': ssid.did
          }
        },
        {
          'claim': {
            'data': {
              'need': 'wine'
            },
            'previous': claimLink
          },
          'ssid': {
            'did': ssid.did
          }
        }
      ])
    })

    it('be able to observe historically with a filter', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimLink = await discipl.claim(ssid, { 'need': 'beer' })
      await discipl.claim(ssid, { 'need': 'wine' })
      await discipl.claim(ssid, { 'need': 'tea' })
      let observable = await discipl.observe(ssid, { 'need': 'wine' }, true)

      let resultPromise = observable.pipe(take(1)).toPromise()

      let result = await resultPromise

      // Delete the connectors to prevent circular references from messing up testing
      delete result.ssid.connector

      expect(result).to.deep.equal(
        {
          'claim': {
            'data': {
              'need': 'wine'
            },
            'previous': claimLink
          },
          'ssid': {
            'did': ssid.did
          }
        }
      )
    })

    it('be able to observe historically with a filter on the predicate', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimLink = await discipl.claim(ssid, { 'need': 'wine' })
      await discipl.claim(ssid, { 'desire': 'wine' })
      await discipl.claim(ssid, { 'need': 'wine' })
      let observable = await discipl.observe(ssid, { 'desire': null }, true)

      let resultPromise = observable.pipe(take(1)).toPromise()

      let result = await resultPromise

      // Delete the connectors to prevent circular references from messing up testing
      delete result.ssid.connector

      expect(result).to.deep.equal(
        {
          'claim': {
            'data': {
              'desire': 'wine'
            },
            'previous': claimLink
          },
          'ssid': {
            'did': ssid.did
          }
        }
      )
    })

    it('not be able to observe historically without an ssid', async () => {
      try {
        await discipl.observe(null, {}, false)
        expect(false).to.equal(true)
      } catch (e) {
        expect(e).to.be.a('error')
        expect(e.message).to.equal('Observe without ssid or connector is not supported')
      }
    })

    it('should be able to export linked verifiable claim channels given a ssid', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let attestorSsid = await discipl.newSsid('ephemeral')

      let attestationLink = await discipl.attest(attestorSsid, 'agree', claimlink2)
      let exportedData = await discipl.exportLD(attestorSsid)

      expect(exportedData[attestorSsid.did][0]).to.deep.equal({ [attestationLink]: { 'agree': { [ssid.did]: [ { [claimlink2]: { 'need': 'wine' } } ] } } })
    })

    it('should be able to export linked verifiable claim channels given a did', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let attestorSsid = await discipl.newSsid('ephemeral')

      let attestationLink = await discipl.attest(attestorSsid, 'agree', claimlink2)
      let exportedData = await discipl.exportLD(attestorSsid.did)

      expect(exportedData[attestorSsid.did][0]).to.deep.equal({ [attestationLink]: { 'agree': { [ssid.did]: [ { [claimlink2]: { 'need': 'wine' } } ] } } })
    })

    it('should be able to export multiple (linked) verifiable claims in a channel in order', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimlink1 = await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let ssid2 = await discipl.newSsid('ephemeral')
      let claimlink3 = await discipl.claim(ssid2, { 'need': 'water' })

      let attestationLink = await discipl.attest(ssid, 'agree', claimlink3)
      let exportedData = await discipl.exportLD(ssid)

      expect(exportedData[ssid.did][0]).to.deep.equal({ [claimlink1]: { 'need': 'beer' } })
      expect(exportedData[ssid.did][1]).to.deep.equal({ [claimlink2]: { 'need': 'wine' } })
      expect(exportedData[ssid.did][2]).to.deep.equal({ [attestationLink]: { 'agree': { [ssid2.did]: [ { [claimlink3]: { 'need': 'water' } } ] } } })
    })

    it('should be able to export more complex json objects as data', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimlink1 = await discipl.claim(ssid, { 'need': 'wine' })
      let claimlink2 = await discipl.claim(ssid, [{ 'need': 'beer' }, claimlink1])

      let ssid2 = await discipl.newSsid('ephemeral')
      let attestationLink = await discipl.attest(ssid2, 'agree', claimlink2)
      let exportedData = await discipl.exportLD(ssid2)

      expect(exportedData[ssid2.did][0]).to.deep.equal({ [attestationLink]: { 'agree': { [ssid.did]: [ { [claimlink2]: [{ 'need': 'beer' }, { [ssid.did]: [ { [claimlink1]: { 'need': 'wine' } } ] }] } ] } } })
    })

    it('should be able to import multiple verifiable claims in multiple channels in order (in ephemeral connector)', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let ssid2 = await discipl.newSsid('ephemeral')

      await discipl.claim(ssid, { 'need': 'food' })
      await discipl.claim(ssid, { 'match': 'link' })
      await discipl.claim(ssid, { 'allow': 'some' })
      await discipl.claim(ssid2, { 'require': 'drink' })
      await discipl.claim(ssid2, { 'solved': 'problem' })
      await discipl.claim(ssid2, { 'attendTo': 'wishes' })
      let ld = await discipl.exportLD(ssid)
      let ld2 = await discipl.exportLD(ssid2)

      // reset ephemeral connector (in memory mode)
      let ConnectorModuleClass = await loadConnector('ephemeral')
      discipl.registerConnector('ephemeral', new ConnectorModuleClass())

      let result = await discipl.importLD({ ...ld, ...ld2 })
      expect(result).to.equal(true)

      let channelData = await discipl.exportLD(ssid)
      expect(channelData[ssid.did][0][Object.keys(channelData[ssid.did][0])]).to.deep.equal({ 'need': 'food' })
      expect(channelData[ssid.did][1][Object.keys(channelData[ssid.did][1])]).to.deep.equal({ 'match': 'link' })
      expect(channelData[ssid.did][2][Object.keys(channelData[ssid.did][2])]).to.deep.equal({ 'allow': 'some' })
      let channelData2 = await discipl.exportLD(ssid2)
      expect(channelData2[ssid2.did][0][Object.keys(channelData2[ssid2.did][0])]).to.deep.equal({ 'require': 'drink' })
      expect(channelData2[ssid2.did][1][Object.keys(channelData2[ssid2.did][1])]).to.deep.equal({ 'solved': 'problem' })
      expect(channelData2[ssid2.did][2][Object.keys(channelData2[ssid2.did][2])]).to.deep.equal({ 'attendTo': 'wishes' })
    })

    it('should be able to import attested (linked) claims in multiple channels (in ephemeral connector)', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let ssid2 = await discipl.newSsid('ephemeral')
      let ssid3 = await discipl.newSsid('ephemeral')

      let link = await discipl.claim(ssid, { 'need': 'food' })
      let link2 = await discipl.claim(ssid2, { 'match': link })
      let link3 = await discipl.claim(ssid3, { 'solved': link2 })

      let ld = await discipl.exportLD(link3)

      // reset ephemeral connector (in memory mode)
      let ConnectorModuleClass = await loadConnector('ephemeral')
      discipl.registerConnector('ephemeral', new ConnectorModuleClass())

      let result = await discipl.importLD(ld)
      expect(result).to.equal(true)

      let channelData = await discipl.exportLD(ssid.did)
      expect(channelData[ssid.did][0][Object.keys(channelData[ssid.did][0])]).to.deep.equal({ 'need': 'food' })
      let channelData2 = await discipl.exportLD(ssid2)
      expect(channelData2[ssid2.did][0][Object.keys(channelData2[ssid2.did][0])]).to.deep.equal({ 'match': { [ssid.did]: [{ [link]: { 'need': 'food' } }] } })
      let channelData3 = await discipl.exportLD(link3)
      expect(channelData3[ssid3.did][0][Object.keys(channelData3[ssid3.did][0])]).to.deep.equal({ 'solved': { [ssid2.did]: [{ [link2]: { 'match': { [ssid.did]: [{ [link]: { 'need': 'food' } }] } } }] } })
    })
  },
  describe('The disciple core API with mocked connector', () => {
    it('should be able to retrieve a new mocked ssid asynchronously', async () => {
      let newSsidStub = sinon.stub().returns({ pubkey: ''.padStart(88, '1'), privkey: ''.padStart(88, '2') })
      let getNameStub = sinon.stub().returns('mock')
      let stubConnector = { newSsid: newSsidStub, getName: getNameStub }

      await discipl.registerConnector('mock', stubConnector)
      let ssid = await discipl.newSsid('mock')

      expect(newSsidStub.calledOnce).to.equal(true)
      expect(getNameStub.calledOnce).to.equal(true)

      expect(ssid.pubkey).to.equal(''.padStart(88, '1'))
      expect(ssid.privkey).to.equal(''.padStart(88, '2'))
      expect(ssid.did).to.equal('did:discipl:mock:' + ''.padStart(88, '1'))
      expect(ssid.connector.getName()).to.equal('mock')
    })

    it('should be able to add a claim to some new channel through a claim() method through a mocked connector', async () => {
      let ssid = { did: 'did:discipl:mock:111' }
      let claimStub = sinon.stub().returns('claimRef')
      let getNameStub = sinon.stub().returns('mock')
      let stubConnector = { claim: claimStub, getName: getNameStub }

      await discipl.registerConnector('mock', stubConnector)
      let claimlink = await discipl.claim(ssid, { 'need': 'beer' })

      expect(claimStub.calledOnceWith({ did: 'did:discipl:mock:111', connector: stubConnector, pubkey: '111' }, { 'need': 'beer' })).to.equal(true)
      expect(getNameStub.calledOnce).to.equal(true)

      expect(claimlink).to.equal('link:discipl:mock:claimRef')
    })
    /*
    it('should be able to add a claim to some new channel through a claim() method with an object as reference', async () => {
      let ssid = { did: 'did:discipl:mock:111' }
      let claimStub = sinon.stub().returns({ someKey: 'infoNeededByConnector' })
      let getNameStub = sinon.stub().returns('mock')
      let stubConnector = { claim: claimStub, getName: getNameStub }

      await discipl.registerConnector('mock', stubConnector)
      let claimlink = await discipl.claim(ssid, { 'need': 'beer' })

      expect(claimStub.calledOnceWith({ did: 'did:discipl:mock:111', connector: stubConnector, pubkey: '111' }, { 'need': 'beer' })).to.equal(true)
      expect(getNameStub.calledOnce).to.equal(true)

      expect(claimlink).to.equal('link:discipl:mock:jdkIBFi8PojrrOV/Z9qtuS+8hDyUUMUkono9Rof4ZxlA6OIQjOWcHeSWGD73fn2I')
    })
*/
    it('should be able to get a claim added through claims', async () => {
      let claimlink = 'link:discipl:mock:claimRef'
      let prevClaimlink = 'link:discipl:mock:previous'

      let getStub = sinon.stub().returns({ 'data': { 'need': 'wine' }, 'previous': 'previous' })
      let getNameStub = sinon.stub().returns('mock')

      let stubConnector = { get: getStub, getName: getNameStub }
      await discipl.registerConnector('mock', stubConnector)

      let claim = await discipl.get(claimlink)

      expect(getStub.calledOnceWith('claimRef', null)).to.equal(true)
      expect(getNameStub.calledOnce).to.equal(true)

      expect(JSON.stringify(claim.data)).to.equal(JSON.stringify({ 'need': 'wine' }))
      expect(claim.previous).to.equal(prevClaimlink)
    })

    it('should be able to get a claim added through claims with columns in the did', async () => {
      let claimlink = 'link:discipl:mock:claimRef:with:some:columns'
      let prevClaimlink = 'link:discipl:mock:previous'

      let getStub = sinon.stub().returns({ 'data': { 'need': 'wine' }, 'previous': 'previous' })
      let getNameStub = sinon.stub().returns('mock')

      let stubConnector = { get: getStub, getName: getNameStub }
      await discipl.registerConnector('mock', stubConnector)

      let claim = await discipl.get(claimlink)

      expect(getStub.calledOnceWith('claimRef:with:some:columns', null), 'Unexpected value for claim ref').to.equal(true)
      expect(getNameStub.calledOnce).to.equal(true)

      expect(JSON.stringify(claim.data)).to.equal(JSON.stringify({ 'need': 'wine' }))
      expect(claim.previous).to.equal(prevClaimlink)
    })

    it('should be able to attest a claim', async () => {
      let ssid = { did: 'did:discipl:mock:111' }
      let claimlink = 'link:discipl:mock:claimRef'

      let claimStub = sinon.stub().returns('attestationRef')
      let getNameStub = sinon.stub().returns('mock')
      let stubConnector = { claim: claimStub, getName: getNameStub }

      await discipl.registerConnector('mock', stubConnector)

      let attestationLink = await discipl.attest(ssid, 'agree', claimlink)
      expect(getNameStub.calledOnce).to.equal(true)
      expect(claimStub.calledOnceWith({ did: 'did:discipl:mock:111', connector: stubConnector, pubkey: '111' }, { 'agree': claimlink })).to.equal(true)

      expect(attestationLink).to.equal('link:discipl:mock:attestationRef')
    })

    it('should be able to verify an attestation', async () => {
      let ssid = { did: 'did:discipl:mock:111' }
      let attestorSsid = { did: 'did:discipl:mock:attestor' }
      let claimlink = 'link:discipl:mock:claimRef'
      let attestationlink = 'link:discipl:mock:attestationRef'

      let verifyStub = sinon.stub()

      verifyStub.onCall(0).returns('attestationRef')
      // No revocations will be found
      verifyStub.onCall(1).returns(null)
      verifyStub.onCall(2).returns(null)

      let getNameStub = sinon.stub().returns('mock')

      let getSsidOfClaimStub = sinon.stub().returns({ pubkey: '111' })

      let stubConnector = { verify: verifyStub, getName: getNameStub, getSsidOfClaim: getSsidOfClaimStub }

      await discipl.registerConnector('mock', stubConnector)

      let verifiedAttestor = await discipl.verify('agree', claimlink, [attestorSsid])

      expect(verifyStub.calledThrice).to.equal(true)
      expect(verifyStub.args[0]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { agree: claimlink }])
      expect(verifyStub.args[1]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { revoke: attestationlink }])
      expect(verifyStub.args[2]).to.deep.equal([{ did: ssid.did, connector: stubConnector, pubkey: '111' }, { revoke: claimlink }])
      expect(getNameStub.calledTwice).to.equal(true)
      expect(getSsidOfClaimStub.calledOnce).to.equal(true)
      expect(getSsidOfClaimStub.args[0]).to.deep.equal(['claimRef'])
      expect(verifiedAttestor.did).to.equal(attestorSsid.did)
    })

    it('should not be able to verify an attestation, if there is no matching claim', async () => {
      let attestorSsid = { did: 'did:discipl:mock:attestor' }
      let claimlink = 'link:discipl:mock:claimRef'

      let verifyStub = sinon.stub().returns(null)

      let stubConnector = { verify: verifyStub }

      await discipl.registerConnector('mock', stubConnector)

      let verifiedAttestor = await discipl.verify('agree', claimlink, [attestorSsid])

      expect(verifyStub.calledOnce).to.equal(true)
      expect(verifyStub.args[0]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { agree: claimlink }])

      expect(verifiedAttestor).to.equal(null)
    })

    it('should not be able to verify an attestation, if the attestation is revoked', async () => {
      let attestorSsid = { did: 'did:discipl:mock:attestor' }
      let claimlink = 'link:discipl:mock:claimRef'
      let attestationlink = 'link:discipl:mock:attestationRef'
      let attestationrevocationlink = 'link:discipl:mock:attestationRevocationRef'

      let verifyStub = sinon.stub()

      verifyStub.onCall(0).returns('attestationRef')
      // A revocation of the attestation will be found
      verifyStub.onCall(1).returns('attestationRevocationRef')
      // No revocations of the revocation will be found
      verifyStub.onCall(2).returns(null)

      let getNameStub = sinon.stub().returns('mock')

      let stubConnector = { verify: verifyStub, getName: getNameStub }

      await discipl.registerConnector('mock', stubConnector)

      let verifiedAttestor = await discipl.verify('agree', claimlink, [attestorSsid])

      expect(verifyStub.callCount).to.equal(3)
      expect(verifyStub.args[0]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { agree: claimlink }])
      expect(verifyStub.args[1]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { revoke: attestationlink }])
      expect(verifyStub.args[2]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { revoke: attestationrevocationlink }])

      expect(getNameStub.callCount).to.equal(2)

      expect(verifiedAttestor).to.equal(null)
    })

    it('should not be able to verify an attestation, if the claim is revoked', async () => {
      let attestorSsid = { did: 'did:discipl:mock:attestor' }
      let claimlink = 'link:discipl:mock:claimRef'
      let attestationlink = 'link:discipl:mock:attestationRef'
      let claimrevocationlink = 'link:discipl:mock:claimRevocationRef'

      let getSsidOfClaimStub = sinon.stub().returns({ pubkey: 'claimant' })
      let verifyStub = sinon.stub()

      verifyStub.onCall(0).returns('attestationRef')
      // No revocation of the attestation will be found
      verifyStub.onCall(1).returns(null)
      // A  revocations of the claim will be found
      verifyStub.onCall(2).returns('claimRevocationRef')
      // No revocation of the revocation of the claim will be found
      verifyStub.onCall(3).returns(null)

      let getNameStub = sinon.stub().returns('mock')

      let stubConnector = { verify: verifyStub, getName: getNameStub, getSsidOfClaim: getSsidOfClaimStub }

      await discipl.registerConnector('mock', stubConnector)

      let verifiedAttestor = await discipl.verify('agree', claimlink, [attestorSsid])

      expect(verifyStub.callCount).to.equal(4)
      expect(verifyStub.args[0]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { agree: claimlink }])
      expect(verifyStub.args[1]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { revoke: attestationlink }])
      expect(verifyStub.args[2]).to.deep.equal([{ did: 'did:discipl:mock:claimant', connector: stubConnector, pubkey: 'claimant' }, { revoke: claimlink }])
      expect(verifyStub.args[3]).to.deep.equal([{ did: 'did:discipl:mock:claimant', connector: stubConnector, pubkey: 'claimant' }, { revoke: claimrevocationlink }])

      expect(getNameStub.callCount).to.equal(3)
      expect(getSsidOfClaimStub.callCount).to.equal(1)

      expect(verifiedAttestor).to.equal(null)
    })
  })
  )
})
