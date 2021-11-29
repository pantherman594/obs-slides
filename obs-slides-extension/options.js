let statusTimeout = undefined;

const saveOptions = () => {
	const obsIP = document.getElementById('obs-server').value;
	const obsPassword = document.getElementById('obs-password').value;
	const usingPassword = document.getElementById('obs-password-on').checked;

	const updated = {
		backendIP: ip,
		obsIP,
	};

	let passwordMessage = '';

	if (obsPassword !== '') {
		updated.obsPassword = obsPassword;
		passwordMessage = ', password set';
	}

	if (!usingPassword) {
		updated.obsPassword = '';
		passwordMessage = ', password cleared';
	}
	
	chrome.storage.sync.set(updated, () => {
		document.getElementById('status').textContent = `OBS URL set to ${obsIP}${passwordMessage}`
		document.getElementById('obs-password').value = ''
		
		if (typeof statusTimeout === 'number') {
			clearTimeout(statusTimeout);
		}
		statusTimeout = setTimeout(() => {
			status.textContent = '';
			statusTimeout = undefined;
		}, 1000);
	})
}

const restoreOptions = () => {
	chrome.storage.sync.get({
		obsIP: 'ws://localhost:4444',
		obsPassword: '',
	}, settings => {
		document.getElementById('obs-server').value = settings.obsIP;
		document.getElementById('obs-password').value = '';
		document.getElementById('obs-password-on').checked = !(settings.obsPassword === '');
		update_password();
	})
}

const updatePassword = () => {
	var elem = document.getElementById('obs-password');
	if (document.getElementById('obs-password-on').checked) {
		elem.disabled = false;
		elem.placeholder = '(unchanged)';
	} else {
		elem.disabled = true;
		elem.placeholder = '(unset)';
	}
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('obs-password-on').addEventListener('change', ev => {
	if (ev.target.checked) {
		document.getElementById('obs-password').disabled = false;
	} else {
		document.getElementById('obs-password').disabled = true;
	}

	updatePassword();
});
