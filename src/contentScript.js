import { ui, pbiNavigator, pbiNavigatorSettings, _d } from "./shared"
import { t } from "lisan"

pbiNavigator.pasteFromClipboard = (newtab)=>{
	let cb = document.createElement("textarea")
	let body = document.getElementsByTagName('body')[0]
	body.appendChild(cb)
	cb.select()
	document.execCommand('paste')
	const clipboardValue = cb.value.trim()
	cb.remove()
	return clipboardValue
}

window.addEventListener("load", ()=>{
	let sessionData = {}
	if(document.body) {
		const variables = ["powerBIAccessToken"] // all we need for now
		let scriptContent = `(()=>{
			document.body.dataset["powerBIAccessToken"] = JSON.stringify(powerBIAccessToken)
		})()`
		let injected = document.createElement('script')
		injected.id = 'tmpScript'
		injected.appendChild(document.createTextNode(scriptContent))
		document.body.appendChild(injected)
		variables.forEach(v=>sessionData[v] = JSON.parse(document.body.dataset[v]))
		document.getElementById("tmpScript").remove()
		variables.forEach(v=>delete document.body.dataset[v])
		pbiNavigator.init(sessionData)
	}
})
chrome.runtime.onMessage.addListener((request, sender, sendResponse)=>{
	try {
		switch(request.action) {
			case "addCommands":
				pbiNavigator.resourceCaches[request.resource] = request.commands
				pbiNavigator.resetCommands()
				break
		}
		return true
	} catch(e) {
		console.error(e)
		return e
	}
})