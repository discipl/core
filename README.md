
## Discipl Core api

For the WHY and HOW of Discipl Core: see http://discipl.org and presentation in the docs folder
(as presented on a first open source ecosystem meetup).

Below you can find the description of the common interface implemented by discipl core bindings:

  - dclocal : simply stores claims (and attestations) locally in an array tied to a DID
  - dciota  : stores claims (and attestations) in public IOTA MAM channels (on the distributed IOTA tangle) tied to a DID

Note this library is in early development. Do not use in production.

## Installation

```
yarn install
```

## Basic Usage

this package will export the DCLOCAL and DCIOTA bindings that export a similair interface as explained in the API (below)

```
npm install discipl-core
```

then in Node:

```
var discipl = require('discipl-core')
discipl.iota.setIOTANode("http://node1.iotatoken.nl:14265");
```

## API

### `setIOTANode`
IOTA only: Sets the IOTA node to connect to. Use a provider URL like: http://iota.discipl.org:14265. 
dciota specific: Optionally can be given a remembered mamState string (stringified JSON object) to start in that state
```
setIOTANode(iotaNodeUrl)
```

### `getState`
IOTA only: gets the current MAM state (as stringified JSON) in the iota binding
```
getState()
```

### `setState`
IOTA only: sets the current MAM state in the iota binding. stateStr must be a stringified JSON MAM state object.
```
setState(stateStr)
```

### `getDid`
Retrieves the DID (did.discipl...) tied to the given private key in the current store
```
getDid(pkey)
```

### `claim`
Stores the given (JSON-LD) claim into the store using an account tied to the subject (an id) in the given linked data triples
which has to be tied to the given private key. All triples should be about the same subject. NB in case of IOTA the pkey is the seed
used by the subject. returns reference to the claim (an universlly unique id)
```
function claim(obj, pkey)
```

### `attest`
Stores an attestation of the given (JSON-LD) claim into the store using a given attestor did with corresponding private key (of the attestor)
the claim is not stored itself but only a keyed hash of it for which the given hashkey is used. The keys are not stored anywhere.
A reference to the stored attestation is returned
```
function attest(obj, pkey, hashkey)
```

### `verify`
evaluates whether the store contains an attestation at the address ref of the given (JSON-LD) claim object attested by (one of) the given attestor(s) using the given hashkey
note currently only capable of receiving one attestor did.
```
function verify(ref, attestor_did, obj, hashkey)
```

### `revoke`
Not Yet Implemented: revokes a particular claim. Verification of a revoked claim or attestation of a claim will result in false.
```
function revoke(ref, pkey)
```

### `getByReference`
the only getter for now is one that requires a direct reference
```
function getByReference(ref, did)
```
