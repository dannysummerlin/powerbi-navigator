setTimeout(()=>{
	try {
		JSON.parse(document.body.dataset.variables)
			.map(v=>document.body.dataset[v] = JSON.stringify(window[v]))
	} catch(e) { console.log(e) }
}, (document.body.dataset.waitTime || 40))