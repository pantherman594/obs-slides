chrome.runtime.onMessage.addListener(notification => {
    chrome.notifications.create({
        type: "basic",
        title: "OBS Slides",
        message: notification,
        iconUrl: "./images/logo_128.png"
    })
})
