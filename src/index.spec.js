import { expect } from "chai";
import * as discipl from '../src/index.js';

describe("desciple-core-api", () => {
    describe("The disciple core API", () => {
        it("should be able to get the memory connector asynchronously", async () => {
            const connector = await discipl.getConnector("memory")
            expect(connector.getName()).to.equal("memory")
            
            expect(connector.getName(), "when loaded for the second time").to.equal("memory")
        })

        it("should be able to retrieve a new ssid asynchronously", async () => {
            let ssid = await discipl.newSsid('memory')
            
            it("which should contain a large random public key, private key and connector object", () => {
                expect(ssid.pubkey).to.be.a('string')
                expect(ssid.pubkey.length).to.equal(88)
                expect(ssid.privkey).to.be.a('string')
                expect(ssid.privkey.length).to.equal(88)
                expect(ssid.pubkey).to.not.equal(ssid.privkey)
                expect(ssid.did).to.equal('did:discipl:memory:' + ssid.pubkey)
                expect(ssid.connector.getName()).to.equal('memory')
            })
        })
    })
})


