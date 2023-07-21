import { pbiNavigator, pbiNavigatorSettings, _d } from "./shared"
import { t } from "lisan"
const SessionData = {}
const showElement = (element)=>{
	chrome.tabs.query({currentWindow: true, active: true}, (tabs)=>{
		switch(element) {
			case "searchBox":
				chrome.tabs.executeScript(tabs[0].id, {code: `
					if(document.getElementById("pbinavSearchBox")) {
						document.getElementById("pbinavSearchBox").style.zIndex = 9999
						document.getElementById("pbinavSearchBox").style.opacity = 0.98
						document.getElementById("pbinavQuickSearch").focus()
					}
				`})
				break
		}
	})
}

const goToUrl = (targetUrl, newTab, settings = {})=>{
	chrome.tabs.query({currentWindow: true, active: true}, (tabs)=>{
		const re = new RegExp("\\w+-extension:\/\/"+chrome.runtime.id,"g");
		targetUrl = targetUrl.replace(re,'')
		let newUrl = targetUrl.match(/.*?\.com(.*)/)
		newUrl = newUrl ? newUrl[1] : targetUrl
		if(!targetUrl.includes('-extension:'))
			newUrl = tabs[0].url.match(/.*?\.com/)[0] + newUrl
		else
			newUrl = targetUrl
		if(newTab)
			chrome.tabs.create({ "active": false, "url": newUrl })
		else
			chrome.tabs.update(tabs[0].id, { "url": newUrl })
	})
}

chrome.commands.onCommand.addListener((command)=>{
	switch(command) {
		case 'showSearchBox': showElement("searchBox"); break
	}
})
chrome.runtime.onMessage.addListener((request, sender, sendResponse)=>{
	const standardHeaders = {"headers": {"Authorization": "Bearer " + request.accessToken, "Accept": "application/json"}}
	switch(request.action) {
		case "goToUrl":
			goToUrl(request.url, request.newTab, request.settings)
			break
		case "init":
			try {
				fetch(`${pbiNavigatorSettings.apiUrl}/groups`, standardHeaders).then(ws=>ws.json()).then(ws=>{
					chrome.tabs.sendMessage(sender.tab.id, { "action": "addCommands", "resource": "workspace", "commands":
						ws.value.map(w=>({ "label": w.name, "key": `workspace.${w.id}`, "url": `https://app.powerbi.com/groups/${w.id}/list?experience=power-bi` }) )
					})
					ws.value.forEach(w=>{
						console.log('w')
						try {
							fetch(`${pbiNavigatorSettings.apiUrl}/groups/${w.id}/dataflows`, standardHeaders).then(ds=>ds.json()).then(ds=>{
								chrome.tabs.sendMessage(sender.tab.id, { "action": "addCommands", "resource": "dataflow", "commands":
									ds.value.map(d=>({ "label": `${w.name} > ${d.name}`, "key": `dataflow.${d.objectId}`, "url": `https://app.powerbi.com/groups/${w.id}/dataflows/${d.objectId}?experience=power-bi` }) )
								})
							})
						} catch(e) { console.error("Error loading dataflows", e); return e }
						try {
							fetch(`${pbiNavigatorSettings.apiUrl}/groups/${w.id}/datasets`, standardHeaders).then(ds=>ds.json()).then(ds=>{
								chrome.tabs.sendMessage(sender.tab.id, { "action": "addCommands", "resource": "dataset", "commands":
									ds.value.map(d=>({ "label": `${w.name} > ${d.name}`, "key": `dataset.${d.id}`, "url": d.webUrl }) )
								})
							})
						} catch(e) { console.error("Error loading datasets", e); return e }
						try {
							fetch(`${pbiNavigatorSettings.apiUrl}/groups/${w.id}/reports`, standardHeaders).then(rs=>rs.json()).then(rs=>{
								chrome.tabs.sendMessage(sender.tab.id, { "action": "addCommands", "resource": "report", "commands":
									rs.value.map(r=>({ "label": `${w.name} > ${r.name}`, "key": `report.${r.id}`, "url": r.webUrl }) )
								})
							})
						} catch(e) { console.error("Error loading datasets", e); return e }
					})
				}).catch(e=>{ sendResponse(e); return false })
				sendResponse("command.loading")
			} catch(e) {
				console.error(e)
				sendResponse(e)
			}
			break
	}
	return true
})