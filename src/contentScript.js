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

const getSettings = ()=>{
	let values = {}
	const variables = ["powerBIAccessToken", "apiUrl"]
// regional redirects are an issue, it loads the brand logo from the right place but there has to be a better way to get it
// https://wabi-north-europe-redirect.analysis.windows.net
// https://wabi-us-north-central-b-redirect.analysis.windows.net
	let scriptContent = `(()=>{
		document.body.dataset["apiUrl"] = JSON.stringify("https://wabi-us-north-central-b-redirect.analysis.windows.net")
		// document.querySelector(".brand-logo").src.replace(/powerbi.+/,'')
		document.body.dataset["powerBIAccessToken"] = JSON.stringify(powerBIAccessToken)
	})()`
	let injected = document.createElement('script')
	injected.id = 'tmpScript'
	injected.appendChild(document.createTextNode(scriptContent))
	document.body.appendChild(injected)
	variables.forEach(v=>values[v] = JSON.parse(document.body.dataset[v]))
	document.getElementById("tmpScript").remove()
	variables.forEach(v=>delete document.body.dataset[v])
	return values
}

window.addEventListener("load", ()=>{
	const settings = getSettings()
	pbiNavigator.init(settings)
})