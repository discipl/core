import { expect } from "chai";
import * as discipl from '../src/index.js';

describe("index test", () => {
    describe("getConnector function", () => {
        it("should be able to get the memory connector", async () => {
            const connector = await discipl.getConnector("memory");
            expect(connector.getName(), "memory")
        })
    })
})
