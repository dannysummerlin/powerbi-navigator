import { ui, pbiNavigator, pbiNavigatorSettings, _d } from "./shared"
import { t } from "lisan"
let firstLoad = true

const loadPBINavigator = (counter)=>{
	if(!firstLoad || pbiNavigator.accessToken)
		return
	if(typeof counter != "number")
		counter = 0
	if(counter === 0)
		firstLoad = false
	let sessionData = {}
	if(document.body && counter < 3) {
		const waitTime = 30 // slight pause to let PowerBI Javascript to run and populate variables
		const variables = ["powerBIAccessToken"] // all we need for now
		let scriptContent = "setTimeout(()=>{ try { " + variables.map(v=>`document.body.dataset["${v}"] = JSON.stringify(${v});`) + `} catch(e) {} }, ${waitTime})`
		let injected = document.createElement('script')
		injected.id = 'tmpScript'
		injected.appendChild(document.createTextNode(scriptContent))
		document.body.appendChild(injected)
		setTimeout(()=>{
			try { variables.forEach(v=>sessionData[v] = JSON.parse(document.body.dataset[v])) }
			catch(e) { loadPBINavigator(counter++) }
			document.getElementById("tmpScript").remove()
			variables.forEach(v=>delete document.body.dataset[v])
			pbiNavigator.init(sessionData)
		}, waitTime * 2)
	}
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse)=>{
	try {
		switch(request.action) {
			case "addCommands":
				pbiNavigator.resourceCaches[request.resource] = new Set([...pbiNavigator.resourceCaches[request.resource], ...request.commands])
				pbiNavigator.loadCommands()
				break
		}
		return true
	} catch(e) {
		console.error(e)
		return e
	}
})

window.addEventListener("load", loadPBINavigator)