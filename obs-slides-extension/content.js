import OBSWebSocket from './lib/obs-websocket';

window.Logger = {
	log: (...log) => console.log('[obs slides]', ...log),
	debug: (...log) => DEV_MODE ? console.log('[obs slides debug]', ...log) : null,
	error: (...error) => console.error('[obs slides error]', ...error),
};

const addButton = () => {
	const style = document.createElement('style');
	style.textContent = `
		#obss_present_with_obs_container:hover {
			box-shadow: none!important;
		}
		#obss_present_with_obs {
			background-image: none;
			border-radius: 4px;
			box-shadow: none;
			box-sizing: border-box;
			font-family: var(--docs-material-header-font-family,Roboto,RobotoDraft,Helvetica,Arial,sans-serif);
			font-weight: var(--docs-material-font-weight-bold,500);
			font-size: 14px;
			height: 36px;
			letter-spacing: 0.25px;
			line-height: 16px;
			background: white;
			border: 1px solid #dadce0!important;
			color: #202124;
			padding: 9px 11px 10px 12px;
			cursor: pointer;
			transition: all 150ms ease;
		}
		#obss_present_with_obs:hover {
			border: 1px solid #feedbc!important;
			background-color: #fffdf6;
		}
	`;

	(document.head || document.documentElement).appendChild(style);

  const slideContainer = document.querySelector('.punch-start-presentation-container');
  const obssButton = document.createElement('a');
	const obssContent = document.createElement('div');

	obssButton.className = 'punch-start-presentation-container';
	obssButton.id = 'obss_present_with_obs_container';
	obssButton.style.textDecoration = 'none';
	obssButton.target = '_blank';
	obssButton.href = window.location.href.replace('edit', 'present');

	obssContent.className = 'goog-inline-block jfk-button jfk-button-standard jfk-button-collapse-right docs-titlebar-button jfk-button-clear-outline';
	obssContent.innerHTML = 'Present w/ OBS';
	obssContent.id = 'obss_present_with_obs';

	obssButton.appendChild(obssContent),
	slideContainer.before(obssButton)
}

const injectViewerData = () => {
	var s = document.createElement('script');
	s.src = chrome.runtime.getURL('inject_viewerData.js');
	s.onload = function() {
			this.remove();
	};
	(document.head || document.documentElement).appendChild(s);
};

const runOnWindow = (command, ...args) => {
	document.body.setAttribute('command', JSON.stringify({ command, args }));
};

const nextSlide = () => runOnWindow('nextSlide');
const prevSlide = () => runOnWindow('prevSlide');

const getSlide = () => parseInt(document.getElementById(':i').textContent);

const setSlide = (num) => runOnWindow('setSlide', num);

const reloadSlides = () => runOnWindow('reloadSlides');

const sleep = (time) => new Promise((resolve, _reject) => {
	setTimeout(() => resolve(), time);
});

const startOBSWebsocket = async () => {
	// Uniquely identify this instance.
	const slideNonce = new Date().getTime();
	Logger.log('START', slideNonce);

	const obs = new OBSWebSocket();
	await obs.connect({ address: 'localhost:4444', password: 'DavidShen' });
	const {_currentScene, scenes } = await obs.send('GetSceneList');

	let sceneNames = scenes.map((s) => s.name);

	const slides = viewerData.docData[1].map((slide) => {
		var tmp = document.createElement('div');
		tmp.innerHTML = slide[9];
		const notes = tmp.textContent;

		const sceneMatch = notes.match(/\[% (.+) %\]/);
		let scene = null;
		if (sceneMatch) {
			scene = sceneMatch[1];
			
			if (!sceneNames.includes(scene)) {
				scene = null;
			}
		}
		
		return {
			id: slide[0],
			index: slide[1],
			title: slide[2],
			notesHtml: slide[9],
			notesText: notes,
			scene,
			visible: slide[12] === 1,
		};
	});

	const sendCurrentSlide = () => {
		const slideIndex = getSlide() - 1;
		obs.send('BroadcastCustomMessage', {
			realm: 'obs-slides-controller',
			data: {
				command: 'updateSlides',
				args: JSON.stringify([ slideNonce, viewerData.docId, slideIndex, slides ]),
			},
		});
	};

	const updateSlide = () => {
		const slideIndex = getSlide() - 1;

		const { scene } = slides[slideIndex];
		if (scene) {
			Logger.log(scene);
			obs.send('SetCurrentScene', { 'scene-name': scene });
		}

		sendCurrentSlide();
	};

	const commands = {
		nextSlide,
		prevSlide,
		setSlide,
		getSlides: sendCurrentSlide,
		reloadSlides,
	};

	obs.on('ScenesChanged', ({ scenes }) => {
		sceneNames = scenes.map((s) => s.name);
	});

	obs.on('BroadcastCustomMessage', ({ realm, data }) => {
		if (realm !== 'obs-slides-client') return;

		const { command, args } = data;
		console.log(command, args);
		commands[command] && commands[command](...JSON.parse(args));
	});

	const observer = new MutationObserver(updateSlide);
	observer.observe(document.getElementById(':i'), { attributes: true });

	updateSlide();
};

const main = async () => {
	const { host, pathname } = window.location;
	if (host === 'docs.google.com' && pathname.includes('/presentation/')) {
		injectViewerData();

		const trimmedPath = pathname.replace(/\/presentation\/(u\/1\/)?d\//, '')
		const [_id, command, ..._rest] = trimmedPath.split('/');

		switch (command) {
			case 'edit':
				addButton();
				break;
			case 'present':
				await sleep(500);
				runOnWindow('setViewerData');
				while (!document.body.hasAttribute('viewerData')) 
					await sleep(500);

				// viewerData is guaranteed to be set by this point.
				window.viewerData = JSON.parse(document.body.getAttribute('viewerData'));

				startOBSWebsocket();
				break;
			default:
				break;
		}
	}
};

main();
