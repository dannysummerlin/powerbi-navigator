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
		const variables = ["powerBIAccessToken"]
		let injected = document.createElement('script')
		injected.id = 'tmpScript'
		injected.src = chrome.runtime.getURL('getToken.js')
		document.body.dataset.waitTime = pbiNavigatorSettings.waitTime
		document.body.dataset.variables = JSON.stringify(variables)
		injected.onload = function() { this.remove() }
		document.body.appendChild(injected)
		setTimeout(()=>{
			try { variables.forEach(v=>sessionData[v] = JSON.parse(document.body.dataset[v])) }
			catch(e) { loadPBINavigator(counter++) }
			variables.forEach(v=>delete document.body.dataset[v])
			pbiNavigator.init(sessionData)
		}, pbiNavigatorSettings.waitTime * 2)
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
		sendResponse(true)
	} catch(e) {
		console.error(e)
		return e
	}
})

window.addEventListener("load", loadPBINavigator)