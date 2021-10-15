/* eslint-env mocha */
import { expect } from 'chai'

import { DisciplCore } from '../src'
import Ipv8DockerUtil from './util/ipv8docker'

let disciplEmployee
let disciplEmployer
const peers = {
  'employee': { did: 'did:discipl:ipv8:TGliTmFDTFBLOvA8oRxG5J1f/JeQeKE4KC0u7xyhzmngxCceiI9myNc8k8yrHXuJ4H/QRNuyNAZ8TVvphqRPNQv4cP559EjFHu4=', url: 'http://localhost:14410' },
  'employer': { did: 'did:discipl:ipv8:TGliTmFDTFBLOkIpAS07E+9CKrYuGIe3ubFRoMUNOxWObE55uIhsm2xmc/sfb/+lrDGjrjdPBkkE3ALxCFQ+KmTB6BM2NJLyaHY=', url: 'http://localhost:14411' }
}

describe('discipl-core-ipv8', () => {
  describe('The Discipl core API with IPv8 connector', () => {
    before(function (done) {
      this.timeout(120000)

      disciplEmployee = new DisciplCore()
      disciplEmployee.getConnector('ipv8').then(conn => conn.configure(peers.employee.url))

      disciplEmployer = new DisciplCore()
      disciplEmployer.getConnector('ipv8').then(conn => conn.configure(peers.employer.url))

      Ipv8DockerUtil.startIpv8Container()
        .then(() => Ipv8DockerUtil.waitForContainersToBeReady())
        .then(() => done())
    })

    after(function (done) {
      Ipv8DockerUtil.killIpv8Container().then(() => done())
    })

    it('should be able to get the connector asynchronously', async () => {
      const connector = await disciplEmployee.getConnector('ipv8')
      expect(connector.getName()).to.equal('ipv8')

      expect(connector.getName(), 'when loaded for the second time').to.equal('ipv8')
    })

    it('should be able to claim something', async function () {
      this.slow(1000)
      const link = await disciplEmployee.claim({ did: peers.employee.did }, { 'need': 'beer' }, { did: peers.employer.did })

      expect(link).to.be.eq('link:discipl:ipv8:temp:eyJuZWVkIjoiYmVlciJ9')
    })

    it('should be able to attest a claim', async function () {
      const linkToAttest = 'link:discipl:ipv8:temp:eyJuZWVkIjoiYmVlciJ9'
      const link = await disciplEmployer.claim({ did: peers.employee.did }, { 'approve': linkToAttest })

      // The IPv8 link is created with a hash so no exact match can be made
      expect(link).to.contain('link:discipl:ipv8:perm:')
      expect(link.length).to.be.eq(87)
    })

    it('should be able to verify a claim', async function () {
      this.timeout(15000)
      this.slow(10000)
      const linkToVerify = 'link:discipl:ipv8:perm:4145d2dc63874fe601b8d8cd3efbfd07edff1a04eadee019be2490505ad4ec26'
      const subscription = (await disciplEmployee.observeVerificationRequests(peers.employee.did))._observable.subscribe(async request => {
        const ipv8Connector = await disciplEmployee.getConnector('ipv8')
        ipv8Connector.ipv8AttestationClient.allowVerify(request.verifier.mid, request.claim.data)
        subscription.unsubscribe()
      })

      const ipv8Connector = await disciplEmployer.getConnector('ipv8')
      ipv8Connector.VERIFICATION_REQUEST_RETRY_TIMEOUT_MS = 500
      ipv8Connector.VERIFICATION_REQUEST_MAX_RETRIES = 5
      const expectedAttester = await disciplEmployer.verify('approve', linkToVerify, [peers.employer.did])

      expect(expectedAttester).to.be.eq(peers.employer.did)
    })
  })
})
