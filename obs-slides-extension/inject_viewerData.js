const setViewerData = () => {
	document.body.setAttribute('viewerData', JSON.stringify(viewerData));
};

const sendKeyboardSequence = (target, sequence) => {
	for (const keyCode of sequence) {
		target.dispatchEvent(new KeyboardEvent('keydown', { keyCode }));
		target.dispatchEvent(new KeyboardEvent('keyup', { keyCode }));
	}
};

const getSlide = () => parseInt(document.getElementById(':i').textContent);

const clamp = (num, min, max) => {
	return Math.min(Math.max(num, min), max);
};

const setSlide = (slideNum) => {
	const totalSlides = viewerData.docData[1].length;
	const n = clamp(slideNum, 1, totalSlides);
	const sequence = String(n).split('').map(l => l.charCodeAt(0));
	sequence.push(13); // enter

	sendKeyboardSequence(document, sequence);
};

const reloadSlides = () => {
	window.location.reload();
};

const nextSlide = () => sendKeyboardSequence(document, [40]);
const prevSlide = () => sendKeyboardSequence(document, [38]);

const commands = {
	setViewerData,
	nextSlide,
	prevSlide,
	setSlide,
	reloadSlides,
};

const runScript = (commandStr) => {
	const { command, args } = JSON.parse(commandStr);

	commands[command] && commands[command](...args);
};

const cmdObserver = new MutationObserver((m) => {
	m.forEach(({ attributeName, oldValue, target }) => {
		let val;
		if (attributeName === 'command' && (val = target.getAttribute(attributeName)) && val !== oldValue) {
			target.removeAttribute(attributeName);
			runScript(val);
		}
	});
});

cmdObserver.observe(document.body, { attributes: true, attributeOldValue: true });
