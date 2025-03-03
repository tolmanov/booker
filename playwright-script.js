const { chromium } = require('playwright');
const dotenv = require('dotenv');

dotenv.config();

const date = new Date()
date.setDate(date.getDate() + 7)
const dateString = date.toLocaleDateString("sv", {timeZone: "Europe/London"})
console.log(dateString)

const courtIds = [
   'bd151ffa-52e1-4322-914e-be82eb341fea',
   '001037ab-d8d2-42d4-a1d1-01def3336cbd',
]

const weekdayPreferences = [
    1080, // 1080 / 60 = 18
    // 1020, // 17
    1140  // 19
];

const weekendPreferences = [
    // 600,
    // 540,
    // 660
];

const weekendDays = [6, 0];  // Saturday and Sunday
const preferences = weekendDays.includes(date.getDay()) ? weekendPreferences : weekdayPreferences;

(async () => {
    const browser = await chromium.launch()
    const context = await browser.newContext();
    const page = await context.newPage()

    await login(page)

    const sessions = await getSessions(page);

    let preference = null;
    let bothHourCourtIds = [];
    let firstHourCourtIds = [];
    let secondHourCourtIds = [];

    for (preference of preferences) {
        firstHourCourtIds = courtIds.filter(courtId => sessions.some(session => session.courtId === courtId && session.startTime === preference.toString(10)))
        // secondHourCourtIds = courtIds.filter(courtId => sessions.some(session => session.courtId === courtId && session.startTime === (preference + 60).toString(10)))
        // bothHourCourtIds = firstHourCourtIds.filter(firstHourCourtId => secondHourCourtIds.includes(firstHourCourtId))

        console.log(preference)
        console.log(firstHourCourtIds)
        // console.log(secondHourCourtIds)
        // console.log(bothHourCourtIds)

        if (!firstHourCourtIds.length) {
            console.log(`Insufficient sessions found for ${preference}`)
            continue
        }

        break
    }

    if (!firstHourCourtIds.length) {
        console.log("Insufficent sessions found");
        browser.close()
    }

    if (firstHourCourtIds.length) {
        console.log('Ready to book a single court')
        const firstSession = sessions.find(session => session.startTime === preference.toString() && session.courtId === firstHourCourtIds[0])
        await book(page, bookingPageUrl(firstHourCourtIds[0], dateString, firstSession.sessionId, preference, preference + 60))
    }
        // console.log('we have a double')
        // const session = sessions.find(session => session.startTime === preference.toString() && session.courtId === bothHourCourtIds[0])
        // await book(page, bookingPageUrl(bothHourCourtIds[0], dateString, session.sessionId, preference, preference + 120))
        // console.log("Double booked")
    // } 
    // else if (firstHourCourtIds.length && secondHourCourtIds.length) {
    //     console.log('going for two singles')
    //     const firstSession = sessions.find(session => session.startTime === preference.toString() && session.courtId === firstHourCourtIds[0])
    //     const secondSession = sessions.find(session => session.startTime === (preference + 60).toString() && session.courtId === secondHourCourtIds[0])
    //     await book(page, bookingPageUrl(firstHourCourtIds[0], dateString, firstSession.sessionId, preference, preference + 60))
    //     await book(page, bookingPageUrl(secondHourCourtIds[0], dateString, secondSession.sessionId, preference + 60, preference + 120))
    //     console.log("Two singles booked")
    // }

    browser.close()
})()

const login = async page => {
    await page.goto('https://clubspark.lta.org.uk/PoplarRecGround/Account/SignIn?returnUrl=%2FPoplarRecGround%2FBooking%2FBookByDate')
    // await page.goto('https://clubspark.lta.org.uk/FinsburyPark/Account/SignIn?returnUrl=%2FFinsburykPark%2FBooking%2FBookByDate')
    const ltaLoginSelector = 'button.lta'
    await page.locator(ltaLoginSelector).click()

    const usernameSelector = 'input[placeholder=Username]'
    await page.locator(usernameSelector).fill(process.env.LTA_USERNAME)

    const passwordSelector = 'input[placeholder=Password]'
    await page.locator(passwordSelector).fill(process.env.LTA_PASSWORD)

    const submitSelector = 'button[title=Login]'
    await page.locator(submitSelector).click()

    const sessionsSelector = '.booking-sheet'
    return await page.waitForSelector(sessionsSelector)
}

const getSessions = async (page) =>  {
    // const url = `https://clubspark.lta.org.uk/FinsburyPark/Booking/BookByDate#?date=${dateString}`;
    const url = `https://clubspark.lta.org.uk/PoplarRecGround/Booking/BookByDate#?date=${dateString}`;
    console.log(url)
    await page.goto(url);

    const sessionsSelector = '.booking-sheet';
    await page.waitForSelector(sessionsSelector);

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

    await delay(3000)

    const sessions = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[data-availability=true] .book-interval'))
            .map((node) => {
                const courtId = node.dataset.testId.split('booking-')[1].split('|')[0];
                const startTime = node.dataset.testId.split('|')[2];
                const sessionId = node.parentNode.parentNode.dataset.sessionId;
                return { courtId, startTime, sessionId };
            });
    });

    console.log(sessions);
    console.log(sessions.length)
    return sessions;
}

const book = async (page, url) => {
    console.log(url)
    await page.goto(url)

    const confirmationButtonSelector = 'button#paynow'
    await page.locator(confirmationButtonSelector).click()

    await page.getByText('Card number').click();
    await page.frameLocator('iframe[title="Secure card number input frame"]').getByPlaceholder('1234 1234 1234 1234').fill(process.env.CC_NUMBER);
    await page.getByText('MM/YY').click();
    await page.frameLocator('iframe[title="Secure expiration date input frame"]').getByPlaceholder('MM / YY').fill(process.env.CC_EXPIRY);
    await page.getByText('CVC').click();
    await page.frameLocator('iframe[title="Secure CVC input frame"]').getByPlaceholder('CVC').fill(process.env.CC_CVC);
    await page.locator('button[type=submit]').click()

    return await page.waitForNavigation()
}

const bookingPageUrl = (courtId, date, sessionId, startTime, endTime) => {
    // return `https://clubspark.lta.org.uk/FinsburyPark/Booking/Book?` + 
    return `https://clubspark.lta.org.uk/PoplarRecGround/Booking/Book?` + 
    `Contacts%5B0%5D.IsPrimary=true&` + 
    `ResourceID=${courtId}&` +
    `Date=${date}&` +
    `SessionID=${sessionId}&` +
    `StartTime=${startTime.toString()}&` + 
    `EndTime=${endTime.toString()}`
}
