const Ranges = require('./components/ranges.js');
const Range = require('./components/range.js');

const clockImage = 'https://' + window.powerupHost + '/images/clock.svg';
const estimateImage = 'https://' + window.powerupHost + '/images/estimate.svg';
const clockImageWhite = 'https://' + window.powerupHost + '/images/clock.svg';
const dataPrefix = 'act-timer';
const apiKey = '2de5d228d2ca7b7bc4c9decc4ee3cbac';
const appName = 'Activity timer';

/**
 * Get estimates for card.
 *
 * @param t
 *
 * @returns {Promise<*>}
 */
async function getEstimates (t) {
    return await t.get('card', 'shared', dataPrefix + '-estimates', []);
}

/**
 * Get own estimate in seconds.
 *
 * @param t
 *
 * @returns {Promise<number>}
 */
async function getOwnEstimate (t) {
    const estimates = await getEstimates(t);
    const member = await t.member('id');
    let time = 0;

    estimates.forEach((estimate) => {
        if (estimate[0] === member.id) {
            time += estimate[1];
        }
    });

    return time;
}

/**
 * Get total estimate time in seconds.
 *
 * @param t
 *
 * @returns {Promise<number>}
 */
async function getTotalEstimate (t) {
    const estimates = await getEstimates(t);
    let time = 0;

    estimates.forEach((estimate) => {
        time += estimate[1];
    });

    return time;
}

/**
 * Create estimate for current member. This will delete past
 * estimates made by same user.
 *
 * @param t
 * @param seconds
 *
 * @returns {Promise<void>}
 */
async function createEstimate (t, seconds) {
    const member = await t.member('id');

    const estimates = (await getEstimates(t)).filter((estimate) => {
        return Array.isArray(estimate) && estimate[0] !== member.id;
    });

    estimates.push([member.id, seconds]);

    await t.set('card', 'shared', dataPrefix + '-estimates', estimates);
}

/**
 * Get all tracked ranges.
 *
 * @param t
 * @param noCurrent
 *
 * @returns {Promise<Ranges>}
 */
async function getRanges (t, noCurrent) {
    noCurrent = noCurrent || false;

    const rangesData = await t.get('card', 'shared', dataPrefix + '-ranges', []);

    if (noCurrent) {
        return Ranges.unserialize(rangesData);
    }

    const startTime = await t.get('card', 'private', dataPrefix + '-start');
    const member = await t.member('id');

    if (startTime) {
        rangesData.push([
            member.id,
            startTime[0],
            Math.floor((new Date().getTime() / 1000))
        ]);
    }

    return Ranges.unserialize(rangesData || '[]');
}

/**
 * Whether or not tracker is running
 *
 * @param t
 *
 * @returns {Promise<boolean>}
 */
async function isRunning (t) {
    return !!(await t.get('card', 'private', dataPrefix + '-start'));
}

/**
 * Get total seconds tracked
 *
 * @param t
 *
 * @returns {Promise<number>}
 */
async function getTotalSeconds (t) {
    const ranges = await getRanges(t);
    return ranges.timeSpent;
}

/**
 * Get own total seconds tracked
 *
 * @param t
 *
 * @returns {Promise<number>}
 */
async function getOwnTotalSeconds (t) {
    const ranges = await getRanges(t);
    const member = await t.member('id');

    return ranges.getTimeSpentByMemberId(member.id);
}

/**
 * Start timer
 *
 * @param t
 *
 * @returns {Promise<void>}
 */
async function startTimer (t) {
    const data = await t.card('idList');

    await t.set('card', 'private', dataPrefix + '-start', [
        Math.floor((new Date().getTime() / 1000)),
        data.idList
    ]);
}

/**
 * Stop timer
 *
 * @param t
 *
 * @returns {Promise<void>}
 */
async function stopTimer (t) {
    const data = await t.get('card', 'private', dataPrefix + '-start');

    if (data) {
        const ranges = await getRanges(t);

        await t.set('card', 'shared', dataPrefix + '-ranges', ranges.serialize());
        await t.remove('card', 'private', dataPrefix + '-start');
    }
}

/**
 * @param secondsToFormat
 *
 * @returns {string}
 */
function formatTime (secondsToFormat) {
    const hours = Math.floor(secondsToFormat / 3600);
    const minutes = Math.floor((secondsToFormat % 3600) / 60);
    const timeFormat = [];

    if (hours > 0) {
        timeFormat.push(hours + 'h');
    }

    if (minutes > 0) {
        timeFormat.push(minutes + 'm');
    }

    return (timeFormat.length > 0 ? timeFormat.join(' ') : '0m');
}

/**
 * @param date
 *
 * @returns {string}
 */
function formatDate (date) {
    const dateStr = [
        date.getFullYear(),
        ((date.getMonth() + 1) < 10 ? '0' : '') + (date.getMonth() + 1),
        (date.getDate() < 10 ? '0' : '') + date.getDate()
    ];

    const timeStr = [
        (date.getHours() < 10 ? '0' : '') + date.getHours(),
        (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
    ];

    return dateStr.join('-') + ' ' + timeStr.join(':');
}

/**
 * Is estimate feature enabled?
 *
 * @param t
 *
 * @returns {Promise<boolean>}
 */
async function hasNotificationsFeature (t) {
    const hasNotificationsFeature = await t.get('member', 'private', dataPrefix + '-disable-notifications');
    return !hasNotificationsFeature && Notification.permission === 'granted';
}

/**
 * Disable estimate feature.
 *
 * @param t
 *
 * @returns {Promise<void>}
 */
async function disableNotificationsFeature (t) {
    await t.set('member', 'private', dataPrefix + '-disable-notifications', 1);
}

/**
 * Enable estimate feature
 *
 * @param t
 *
 * @returns {Promise<void>}
 */
async function enableNotificationsFeature (t) {
    await t.remove('member', 'private', dataPrefix + '-disable-notifications');
}

/**
 * @param t
 *
 * @param percentage
 *
 * @returns {Promise<void>}
 */
async function setNotificationPercentage (t, percentage) {
    await t.set('member', 'private', dataPrefix + '-notifications-percentage', parseInt(percentage, 10));
}


/**
 * @param t
 *
 * @returns {Promise<null|number>}
 */
async function getNotificationPercentage (t) {
    const percentage = await t.get('member', 'private', dataPrefix + '-notifications-percentage');

    if (percentage) {
        return parseInt(percentage, 10);
    }

    return null;
}

/**
 * Check if a members notification have already been fired.
 *
 * @param t
 *
 * @returns {Promise<boolean>}
 */
async function hasTriggeredNotification (t) {
    const notificationTriggered = await t.get('card', 'private', dataPrefix + '-notifications-triggered');
    return !!notificationTriggered;
}

/**
 * Trigger notification.
 *
 * @param t
 *
 * @returns {Promise<void>}
 */
async function triggerNotification (t) {
    const notificationsPercentage = await getNotificationPercentage(t);
    await t.set('card', 'private', dataPrefix + '-notifications-triggered', 1);
    new Notification("You've passed " + notificationsPercentage + "% of your estimated time");
}

/**
 * Whether or not notification can trigger.
 *
 * @param t
 *
 * @returns {Promise<boolean>}
 */
async function canTriggerNotification (t) {
    const isNotificationsEnabled = await hasNotificationsFeature(t);

    if (!isNotificationsEnabled) {
        return false;
    }

    const timeSpent = await getOwnTotalSeconds(t);

    if (timeSpent === 0) {
        return false;
    }

    const notificationsPercentage = await getNotificationPercentage(t);

    if (notificationsPercentage === 0) {
        return false;
    }

    const notificationTriggered = await hasTriggeredNotification(t);

    if (notificationTriggered) {
        return false;
    }

    const estimate = await getOwnEstimate(t);

    if (estimate === 0) {
        return false;
    }

    return timeSpent >= ((estimate / 100) * notificationsPercentage);
}

/**
 * Is estimate feature enabled?
 *
 * @param t
 *
 * @returns {Promise<boolean>}
 */
async function hasEstimateFeature (t) {
    const hasEstimateFeature = await t.get('board', 'shared', dataPrefix + '-disable-estimate');
    return !hasEstimateFeature;
}

/**
 * Disable estimate feature.
 *
 * @param t
 *
 * @returns {Promise<void>}
 */
async function disableEstimateFeature (t) {
    await t.set('board', 'shared', dataPrefix + '-disable-estimate', 1);
}

/**
 * Enable estimate feature
 *
 * @param t
 *
 * @returns {Promise<void>}
 */
async function enableEstimateFeature (t) {
    await t.remove('board', 'shared', dataPrefix + '-disable-estimate');
}

/**
 * Card badges capability handler.
 *
 * @param t
 *
 * @returns {Promise<Array>}
 */
async function cardBadges (t) {
    const items = [{
        dynamic: async function () {
            const running = await isRunning(t);
            const time = await getTotalSeconds(t);

            const object = {
                refresh: 60
            };

            if (time !== 0 || running) {
                object.text = formatTime(time);
                object.icon = clockImage;

                if (running) {
                    const startTime = await t.get('card', 'private', dataPrefix + '-start');
                    const data = await t.card('idList');

                    if (startTime[1] !== data.idList) {
                        await stopTimer(t);
                    } else {
                        const shouldTriggerNotification = await canTriggerNotification(t);

                        if (shouldTriggerNotification) {
                            await triggerNotification(t);
                        }

                        object.color = 'red';
                    }
                }
            }

            return object;
        }
    }];

    const hasEstimateVar = await hasEstimateFeature(t);

    if (hasEstimateVar) {
        const totalEstimate = await getTotalEstimate(t);

        if (totalEstimate > 0) {
            items.push({
                icon: estimateImage,
                text: 'Estimate: ' + formatTime(totalEstimate)
            });
        }
    }

    return items;
}

/**
 * Card buttons capability handler.
 *
 * @param t
 *
 * @returns Array
 */
function cardButtons (t) {
    const items = [
        {
            icon: clockImage,
            text: 'Manage time',
            callback: function (t) {
                return t.popup({
                    title: 'Manage time',
                    items: async function (t) {
                        const ranges = await getRanges(t, true);
                        const items = [];

                        let board = await t.board('members');

                        board.members.sort((a, b) => {
                            const nameA = a.fullName.toUpperCase();
                            const nameB = b.fullName.toUpperCase();

                            if (nameA < nameB) {
                                return -1;
                            }
                            if (nameA > nameB) {
                                return 1;
                            }

                            return 0;
                        }).forEach((member) => {
                            const memberRanges = ranges.items.map((range, rangeIndex) => {
                                range.rangeIndex = rangeIndex;
                                return {
                                    rangeIndex,
                                    item: range
                                };
                            }).filter((range) => {
                                return range.item.memberId === member.id;
                            });

                            if (memberRanges.length > 0) {
                                items.push({
                                    'text': member.fullName + (member.fullName !== member.username ? ' (' + member.username + ')' : '') + ':'
                                });

                                memberRanges.forEach((range) => {
                                    const start = new Date(range.item.start * 1000);
                                    const end = new Date(range.item.end * 1000);
                                    const _rangeIndex = range.rangeIndex;
                                    const _range = range;

                                    items.push({
                                        text: formatDate(start) + ' - ' + formatDate(end),
                                        callback: function (t) {
                                            return t.popup({
                                                title: 'Edit time range',
                                                items: function (t) {
                                                    const _start = new Date(_range.item.start * 1000);
                                                    const _end = new Date(_range.item.end * 1000);

                                                    return [
                                                        {
                                                            text: 'Edit start (' + formatDate(start) + ')',
                                                            callback: (t) => {
                                                                return t.popup({
                                                                    type: 'datetime',
                                                                    title: 'Change start from (' + formatDate(_start) + ')',
                                                                    callback: async function(t, opts) {
                                                                        const ranges = await getRanges(t, true);
                                                                        ranges.items[_rangeIndex].start = Math.floor(new Date(opts.date).getTime() / 1000);
                                                                        await ranges.saveForContext(t);
                                                                        return t.closePopup();
                                                                    },
                                                                    date: _start
                                                                });
                                                            }
                                                        },
                                                        {
                                                            text: 'Edit end (' + formatDate(end) + ')',
                                                            callback: (t) => {
                                                                return t.popup({
                                                                    type: 'datetime',
                                                                    title: 'Change end from (' + formatDate(_end) + ')',
                                                                    callback: async function(t, opts) {
                                                                        const ranges = await getRanges(t, true);
                                                                        ranges.items[_rangeIndex].end = Math.floor(new Date(opts.date).getTime() / 1000);
                                                                        await ranges.saveForContext(t);
                                                                        return t.closePopup();
                                                                    },
                                                                    date: _end
                                                                });
                                                            }
                                                        },
                                                        {
                                                            text: 'Delete',
                                                            callback: async (t) => {
                                                                const ranges = await getRanges(t, true);
                                                                ranges.deleteRangeByIndex(_rangeIndex);
                                                                await ranges.saveForContext(t);
                                                                return t.closePopup();
                                                            }
                                                        }
                                                    ];
                                                }
                                            });
                                        },
                                    });
                                });

                                items.push({
                                    'text': '--------'
                                });
                            }
                        });

                        if (items.length > 0) {
                            items.splice(items.length - 1, 1);
                        }

                        if (items.length > 0) {
                            items.push({
                                'text': '--------'
                            });

                            items.push({
                                'text': 'Clear',
                                callback: async (t) => {
                                    return t.popup({
                                        type: 'confirm',
                                        title: 'Clear time',
                                        message: 'Do you wish to clear tracked time?',
                                        confirmText: 'Yes, clear tracked time',
                                        onConfirm: async (t) => {
                                            await t.remove('card', 'shared', dataPrefix + '-ranges');
                                            await t.remove('card', 'private', dataPrefix + '-start');
                                            await t.closePopup();
                                        },
                                        confirmStyle: 'danger',
                                        cancelText: 'No, cancel'
                                    });
                                }
                            });
                        } else {
                            items.push({ 'text': 'No activity yet' });
                        }

                        return items;
                    }
                });
            },
            condition: 'edit'
        },
        {
            icon: clockImage,
            text: 'Time spent',
            callback: function (t) {
                return t.popup({
                    title: 'Time spent',
                    items: async function (t) {
                        const ranges = await getRanges(t, true);
                        const items = [];

                        let board = await t.board('members');

                        board.members.sort((a, b) => {
                            const nameA = a.fullName.toUpperCase();
                            const nameB = b.fullName.toUpperCase();

                            if (nameA < nameB) {
                                return -1;
                            }
                            if (nameA > nameB) {
                                return 1;
                            }

                            return 0;
                        }).forEach((member, memberIndex) => {
                            const timeSpent = ranges.getTimeSpentByMemberId(member.id);

                            if (timeSpent !== 0) {
                                items.push({
                                    'text': member.fullName + (member.fullName !== member.username ? ' (' + member.username + ')' : '') + ': ' +  formatTime(timeSpent)
                                });
                            }
                        });

                        if (items.length === 0) {
                            items.push({ 'text': 'No activity yet' });
                        }

                        return items;
                    }
                });
            }
        }
    ];

    if ('Notification' in window) {
        items.push({
            icon: clockImage,
            text: 'Notifications',
            callback: (t) => {
                return t.popup({
                    title: 'Activity timer notifications',
                    url: t.signUrl('./notifications.html'),
                    height: 85
                });
            }
        });
    }

    return items;
}

/**
 * Card back section capability handler.
 *
 * @param t
 *
 * @returns {{title: string, content: {type: string, url: *, height: number}}}
 */
function cardBackSection (t) {
    return {
        title: 'Activity timer',
        icon: clockImage,
        content: {
            type: 'iframe',
            url: t.signUrl('./card_back_section.html'),
            height: 40
        }
    };
}

/**
 * Click handler for board button.
 *
 * @param t
 *
 * @returns {Promise<void>}
 */
async function onBoardButtonClick (t) {
    await t.modal({
        url: t.signUrl('./history.html'),
        title: 'Activity timer history',
        fullscreen: false
    });
}

/**
 * Board button capability handler.
 *
 * @param t
 *
 * @returns Array
 */
function boardButtons (t) {
    return [{
        icon: {
            dark: clockImage,
            light: clockImageWhite
        },
        text: 'Activity timer history',
        callback: onBoardButtonClick,
        condition: 'always'
    }];
}

/**
 * Show settings capability handler.
 *
 * @param t
 *
 * @returns {*}
 */
function showSettings (t) {
    return t.popup({
        title: 'Activity timer settings',
        url: t.signUrl('./settings.html'),
        height: 85
    });
}

module.exports = {
    cardBadges,
    cardButtons,
    isRunning,
    getTotalSeconds,
    startTimer,
    stopTimer,
    formatTime,
    clockImage,
    cardBackSection,
    boardButtons,
    apiKey,
    appName,
    getOwnEstimate,
    getTotalEstimate,
    createEstimate,
    getEstimates,
    showSettings,
    hasEstimateFeature,
    disableEstimateFeature,
    enableEstimateFeature,
    enableNotificationsFeature,
    disableNotificationsFeature,
    hasNotificationsFeature,
    setNotificationPercentage,
    getNotificationPercentage
};