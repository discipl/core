## Modules

<dl>
<dt><a href="#module_discipl-core">discipl-core</a></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#loadConnector">loadConnector()</a></dt>
<dd><p>loads a connector based on module name using a dynamic import</p>
</dd>
</dl>

<a name="module_discipl-core"></a>

## discipl-core

* [discipl-core](#module_discipl-core)
    * [~initializeConnector(connectorName)](#module_discipl-core..initializeConnector) ⇒ <code>Promise.&lt;void&gt;</code>
    * [~getConnector(connectorName)](#module_discipl-core..getConnector) ⇒ <code>Promise.&lt;\*&gt;</code>
    * [~registerConnector(name, connector)](#module_discipl-core..registerConnector)
    * [~getDidOfLinkedClaim(link)](#module_discipl-core..getDidOfLinkedClaim) ⇒ <code>Promise.&lt;string&gt;</code>
    * [~newSsid(connectorName)](#module_discipl-core..newSsid) ⇒ <code>Promise.&lt;{privkey: string, did: string}&gt;</code>
    * [~claim(ssid, data)](#module_discipl-core..claim) ⇒ <code>Promise.&lt;string&gt;</code>
    * [~attest(ssid, predicate, link)](#module_discipl-core..attest) ⇒ <code>Promise.&lt;string&gt;</code>
    * [~verify(predicate, link, dids, verifierSsid)](#module_discipl-core..verify) ⇒ <code>Promise.&lt;string&gt;</code>
    * [~get(link, ssid)](#module_discipl-core..get) ⇒ <code>Promise.&lt;{data: object, previous: string}&gt;</code>
    * [~observe(did, claimFilter, historical, connector, observerSsid)](#module_discipl-core..observe) ⇒ <code>ObserveResult</code>
    * [~exportLD()](#module_discipl-core..exportLD)
    * [~importLD()](#module_discipl-core..importLD)
    * [~revoke(ssid, link)](#module_discipl-core..revoke)

<a name="module_discipl-core..initializeConnector"></a>

### discipl-core~initializeConnector(connectorName) ⇒ <code>Promise.&lt;void&gt;</code>
Requires and holds in memory the given discipl connector (if not done before)

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  

| Param | Type |
| --- | --- |
| connectorName | <code>string</code> | 

<a name="module_discipl-core..getConnector"></a>

### discipl-core~getConnector(connectorName) ⇒ <code>Promise.&lt;\*&gt;</code>
Returns the connector object of the given discipl connector. Automaticly lazy loads the corresponding module

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
**Returns**: <code>Promise.&lt;\*&gt;</code> - The connector (needs to extend [BaseConnector](BaseConnector))  

| Param | Type |
| --- | --- |
| connectorName | <code>string</code> | 

<a name="module_discipl-core..registerConnector"></a>

### discipl-core~registerConnector(name, connector)
Registers a connector explicitly.

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | Name of the connector |
| connector | <code>object</code> | Instantiated object representing the connector |

<a name="module_discipl-core..getDidOfLinkedClaim"></a>

### discipl-core~getDidOfLinkedClaim(link) ⇒ <code>Promise.&lt;string&gt;</code>
Retrieves the did that made the claim referenced in the given link

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
**Returns**: <code>Promise.&lt;string&gt;</code> - did  

| Param | Type |
| --- | --- |
| link | <code>string</code> | 

<a name="module_discipl-core..newSsid"></a>

### discipl-core~newSsid(connectorName) ⇒ <code>Promise.&lt;{privkey: string, did: string}&gt;</code>
Generates a new ssid using the specified connector

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  

| Param | Type | Description |
| --- | --- | --- |
| connectorName | <code>string</code> | Name of the connector used |

<a name="module_discipl-core..claim"></a>

### discipl-core~claim(ssid, data) ⇒ <code>Promise.&lt;string&gt;</code>
Adds a claim to the (end of the) channel of the given ssid. Returns a link to this claim.

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  

| Param | Type | Description |
| --- | --- | --- |
| ssid | <code>object</code> |  |
| ssid.did | <code>string</code> | Did that makes the claim |
| ssid.privkey | <code>string</code> | Private key to sign the claim |
| data | <code>object</code> | Data to be claimed |

<a name="module_discipl-core..attest"></a>

### discipl-core~attest(ssid, predicate, link) ⇒ <code>Promise.&lt;string&gt;</code>
Adds an attestation claim of the claim the given link refers to using the given predicate in the channel of the given ssid

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
**Returns**: <code>Promise.&lt;string&gt;</code> - Link to the attestation  

| Param | Type | Description |
| --- | --- | --- |
| ssid | <code>object</code> |  |
| ssid.did | <code>string</code> | Did that makes the attestation |
| ssid.privkey | <code>string</code> | Private key to sign the attestation |
| predicate | <code>string</code> | Statement being made about the claim linked |
| link | <code>string</code> | Object of the attestation |

<a name="module_discipl-core..verify"></a>

### discipl-core~verify(predicate, link, dids, verifierSsid) ⇒ <code>Promise.&lt;string&gt;</code>
Will verify existence of an attestation of the claim referenced in the given link and mentioning the given predicate.
If the referenced claim or an attestation itself are revoked, the method will not evaluate the claim as having been attested.

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
**Returns**: <code>Promise.&lt;string&gt;</code> - The first did that attested, null if none have.  

| Param | Type | Description |
| --- | --- | --- |
| predicate | <code>string</code> |  |
| link | <code>string</code> |  |
| dids | <code>Array.&lt;string&gt;</code> |  |
| verifierSsid | <code>object</code> | ssid object that grants access to the relevant claims |

<a name="module_discipl-core..get"></a>

### discipl-core~get(link, ssid) ⇒ <code>Promise.&lt;{data: object, previous: string}&gt;</code>
Retrieves the data of the claim a given link refers to along with a link to the previous claim in the same channel.

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| link | <code>string</code> |  | link to the claim of which the data should be retrieved |
| ssid | <code>object</code> | <code></code> | Optional: Authorizaiton method if the claim in question is not publically visible |
| ssid.did | <code>string</code> |  | Did that makes the request |
| ssid.privkey | <code>string</code> |  | Private key to sign the request |

<a name="module_discipl-core..observe"></a>

### discipl-core~observe(did, claimFilter, historical, connector, observerSsid) ⇒ <code>ObserveResult</code>
Returns an Observable with claims

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| did | <code>string</code> |  | Did to filter claims |
| claimFilter | <code>object</code> |  | filters by the content of claims |
| historical | <code>boolean</code> | <code>false</code> | if true, the result will start at the beginning of the channel |
| connector | <code>object</code> | <code></code> | needs to be provided in order to listen platform-wide without ssid |
| observerSsid | <code>object</code> |  | Ssid to allow access to claims |

<a name="module_discipl-core..exportLD"></a>

### discipl-core~exportLD()
Exports linked claim data starting with the claim the given link refers to.
Links contained in the data of the claim are exported also in a value alongside of the link and links in data of those claims are processed in a same way too etc.
By default, expansion like this is done at most three times. You can alter this depth of the export by setting the second argument. If the maximum depth is reached the exported data
will contain the value MAX_DEPTH_REACHED alongside of the link instead of an exported dataset. You can use this method to iteratively expand the dataset using the link that was not followed.
A claim is never exported twice; circulair references are not followed.

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..importLD"></a>

### discipl-core~importLD()
Imports claims given a dataset as returned by exportLD. Claims linked in the claims are not imported (so max depth = 1)
Not all connectors will support this method and its functioning may be platform specific. Some may actually let you
create claims in bulk through this import. Others will only check for existence and validate.

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  
<a name="module_discipl-core..revoke"></a>

### discipl-core~revoke(ssid, link)
Adds a revocation attestation to the channel of the given ssid. Effectively revokes the claim the given link refers to. Subsequent verification of the claim will not succeed.

**Kind**: inner method of [<code>discipl-core</code>](#module_discipl-core)  

| Param | Type | Description |
| --- | --- | --- |
| ssid | <code>json</code> | The ssid json object. The attestation is added to the channel of this ssid |
| link | <code>string</code> | The link to the claim (or attestation) that should be attested as being revoked. Note that this claim must be in the channel of the given ssid to be effectively seen as revoked. |

<a name="loadConnector"></a>

## loadConnector()
loads a connector based on module name using a dynamic import

**Kind**: global function  
