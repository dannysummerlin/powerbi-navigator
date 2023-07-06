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

pbiNavigator.init()