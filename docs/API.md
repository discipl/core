<a name="module_discipl-core"></a>

## discipl-core

* [discipl-core](#module_discipl-core)
    * [~initializeConnector()](#module_discipl-core..initializeConnector)
    * [~getConnector()](#module_discipl-core..getConnector)
    * [~registerConnector(name, connector)](#module_discipl-core..registerConnector)
    * [~splitLink()](#module_discipl-core..splitLink)
    * [~getLink()](#module_discipl-core..getLink)
    * [~isValidLink()](#module_discipl-core..isValidLink)
    * [~getSsidOfLinkedClaim()](#module_discipl-core..getSsidOfLinkedClaim)
    * [~getHash()](#module_discipl-core..getHash)
    * [~newSsid()](#module_discipl-core..newSsid)
    * [~claim()](#module_discipl-core..claim)
    * [~attest()](#module_discipl-core..attest)
    * [~verify()](#module_discipl-core..verify)
    * [~get(link, ssid)](#module_discipl-core..get) ⇒ <code>json</code>
    * [~subscribe(ssid)](#module_discipl-core..subscribe)
    * [~detectSsidLinkFromDidSsidOrLink()](#module_discipl-core..detectSsidLinkFromDidSsidOrLink)
    * [~exportLD()](#module_discipl-core..exportLD)
    * [~revoke(ssid, link)](#module_discipl-core..revoke)

<a name="module_discipl-core..initializeConnector"></a>

### discipl-core~initializeConnector()
requires and holds in memory the given discipl connector (if not done before)

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..getConnector"></a>

### discipl-core~getConnector()
returns the connector object of the given discipl connector. Automaticly lazy loads the corresponding module

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..registerConnector"></a>

### discipl-core~registerConnector(name, connector)
Registers a connector explicitly.

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  

| Param | Description |
| --- | --- |
| name | of the connector. Packages containing a connector follow the naming convention CONNECTOR_MODULE_PREFIX + name |
| connector | instantiated object representing the connector |

<a name="module_discipl-core..splitLink"></a>

### discipl-core~splitLink()
extracts connector name and reference from a link string and returns it as a json object in the form of: {connector, reference}

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..getLink"></a>

### discipl-core~getLink()
returns a link string for the given claim in the channel of the given ssid. claim can be a string in which case it needs to be a connector specific reference string, or it is a object holding claim(s) of which the hash of the stringified version is used as reference

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..isValidLink"></a>

### discipl-core~isValidLink()
checks if a given string seems to be a valid link (correct syntax and refers to an available connector). Does not check the claim the link refers to exists or not. The reference is not checked

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..getSsidOfLinkedClaim"></a>

### discipl-core~getSsidOfLinkedClaim()
Retrieves an Ssid object for the claim referenced in the given link. Note that the Ssid object will not contain the private key for obvious reasons

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..getHash"></a>

### discipl-core~getHash()
returns a HMAC-384 peppered hash of the given data with the did of the given ssid as key

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..newSsid"></a>

### discipl-core~newSsid()
Generates a new ssid, a json object in the form of: {connector:connectorObj, did:did, pubkey:pubkey, privkey:privkey}, for the platform the given discipl connector name adds support for

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..claim"></a>

### discipl-core~claim()
Adds a claim to the (end of the) channel of the given ssid (containing the did and probably privkey as only requirement). Returns a link to this claim.

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..attest"></a>

### discipl-core~attest()
Adds an attestation claim of the claim the given link refers to using the given predicate in the channel of the given ssid

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..verify"></a>

### discipl-core~verify()
Will verify existence of an attestation of the claim referenced in the given link and mentioning the given predicate.
It will check the channels of the given ssid's. By default it will return the first ssid whose channel contained a matching attestation.
You can also make this method check the channel of every ssid after which the method will return an array of all ssid's that have attested.
If the referenced claim or an attestation itself are revoked, the method will not evaluate the claim as been attested.
If none of the given ssid's have attested, the method returns null

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..get"></a>

### discipl-core~get(link, ssid) ⇒ <code>json</code>
Retrieves the data of the claim a given link refers to along with a link to the previous claim in the same channel.

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
**Returns**: <code>json</code> - - {data, linkToPrevious}  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| link | <code>string</code> |  | link to the claim of which the data should be retreved |
| ssid | <code>json</code> | <code></code> | Optional : the ssid of the actor (on the same platform as the claim the links refers to) that wants to get the data but may not have permission without identifying itself |

<a name="module_discipl-core..subscribe"></a>

### discipl-core~subscribe(ssid)
Subscribes a given callback function to be called when new claims are found in a given channel. Note that it will start at the end of the channel; previous claims that has already been added in the channel are ignored.

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  

| Param | Type | Description |
| --- | --- | --- |
| ssid | <code>json</code> | The ssid json object containing did as public key : {pubkey:did, privkey:pkey}. This should be the ssid of the channel to subscribe to |

<a name="module_discipl-core..detectSsidLinkFromDidSsidOrLink"></a>

### discipl-core~detectSsidLinkFromDidSsidOrLink()
Helper method for exportLD which detects a value to be a ssid, did or link and returns the ssid and link (the one given or to the latest claim in a channel of a did/ssid) or null otherwise
throws error when given a object intended to be a ssid but isn't

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..exportLD"></a>

### discipl-core~exportLD()
Exports linked claim data starting with the claim the given link refers to.
Links contained in the data of the claim are exported also in a value alongside of the link and links in data of those claims are processed in a same way too etc.
By default, expansion like this is done at most three times. You can alter this depth of the export by setting the second argument. If the maximum depth is reached the exported data
will contain the value MAX_DEPTH_REACHED alongside of the link instead of an exported dataset. You can use this method to iteratively expand the dataset using the link that was not followed.
A claim is never exported twice; circulair references are not followed.

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..revoke"></a>

### discipl-core~revoke(ssid, link)
Adds a revocation attestation to the channel of the given ssid. Effectively revokes the claim the given link refers to. Subsequent verification of the claim will not succeed.

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  

| Param | Type | Description |
| --- | --- | --- |
| ssid | <code>json</code> | The ssid json object. The attestation is added to the channel of this ssid |
| link | <code>string</code> | The link to the claim (or attestation) that should be attested as being revoked. Note that this claim must be in the channel of the given ssid to be effectively seen as revoked. |

