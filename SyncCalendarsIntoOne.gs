// Calendars to merge from.
// Emoji is placed in front of your calendar event in the target calendar.
// Use '' if you want none.
const CALENDARS_TO_MERGE = {
  '🏖️': 'calendar-id@gmail.com',
  '💾': 'calendar-id@gmail.com',
};

// Tag that will be added to all synced events
// EVENTS WITH THIS TAG WILL BE DELETED AND RECREATED AFTER EACH SCRIPT RUN
const IGNORE_TAG = '↖️'

// The ID of the calendar you want to merge to
const CALENDAR_TO_MERGE_INTO = 'target-calendar-id@gmail.com';

// Number of days in the future to run.
const DAYS_TO_SYNC = 30;

// Ignore events with the same start and end datetime as existing events.
// Assume they have been copied from the CALENDAR_TO_MERGE_INTO
// when running the script on multiple accounts to cross-synchronize
// calendars.
const IGNORE_EVENTS_WITH_SAME_START_AND_END_DATETIME = true;

// The ID of the color to use for created events.
// Pick one from the `events` section of the following API:
// https://developers.google.com/calendar/v3/reference/colors/get
// You can use the "Try this API" right sidebar to see the exact values.
// Use `undefined` (without quotes) to use the default calendar color.
const SYNCED_EVENTS_COLOR_ID = '5';

// Whether the disable the default reminders (e.g. 10 mins before the event)
// for created events.
const DISABLE_REMINDERS = true;

// ----------------------------------------------------------------------------
// DO NOT TOUCH FROM HERE ON
// ----------------------------------------------------------------------------
function deleteCreatedEvents(startTime, endTime) {
  let requestBody = [];
  // Find events
  const events = Calendar.Events.list(CALENDAR_TO_MERGE_INTO, {
    timeMin: startTime.toISOString(),
    timeMax: endTime.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const originalEvents = [];

  events.items.forEach((event) => {
    // Delete events with summary starting with IGNORE_TAG
    if (event.summary && String(event.summary).startsWith(IGNORE_TAG)) {
      requestBody.push({
        method: 'DELETE',
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_TO_MERGE_INTO}/events/${event.id}`
      })
    } else {
      originalEvents.push(event);
    }
  });
  
  if (requestBody && requestBody.length) {
    const result = BatchRequest.EDo({
      useFetchAll: true,
      batchPath: 'batch/calendar/v3',
      requests: requestBody,
    });
    console.log(`${requestBody.length} deleted events.`);
  } else {
    console.log('No events to delete.');
  }

  return originalEvents;
}

function createEvents(startTime, endTime, originalEvents) {
  let requestBody = [];

  for (let calenderName in CALENDARS_TO_MERGE) {
    const calendarId = CALENDARS_TO_MERGE[calenderName];
    const calendarToCopy = CalendarApp.getCalendarById(calendarId);

    if (!calendarToCopy) {
      console.log("Calendar not found: '%s'.", calendarId);
      continue;
    }

    // Find events
    const events = Calendar.Events.list(calendarId, {
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    // If nothing find, move to next calendar
    if (!(events.items && events.items.length > 0)) {
      continue;
    }

    events.items.forEach((event) => {

      // Don't copy "free" events.
      if (event.transparency && event.transparency === 'transparent') {
        return;
      }

      if (IGNORE_EVENTS_WITH_SAME_START_AND_END_DATETIME && originalEvents.find(originalEvent => originalEvent.start.dateTime === event.start.dateTime && originalEvent.end.dateTime === event.end.dateTime)) {
        return;
      }

      requestBody.push({
        method: 'POST',
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_TO_MERGE_INTO}/events`,
        requestBody: {
          summary: `${IGNORE_TAG} ${calenderName} ${event.summary || 'Busy'}`,
          location: event.location,
          description: event.description,
          start: event.start,
          end: event.end,
          colorId: SYNCED_EVENTS_COLOR_ID,
          reminders: {
            useDefault: !DISABLE_REMINDERS,
          },
        },
      });
    });
  }

  if (requestBody && requestBody.length) {
    const result = BatchRequest.EDo({
      batchPath: 'batch/calendar/v3',
      requests: requestBody,
    });
    console.log(`${requestBody.length} events created via BatchRequest`);
  } else {
    console.log('No events to create.');
  }
}

function SyncCalendarsIntoOne() {
  // Midnight today
  const startTime = new Date();
  startTime.setHours(0, 0, 0, 0);

  const endTime = new Date(startTime.valueOf());
  endTime.setDate(endTime.getDate() + DAYS_TO_SYNC);

  const originalEvents = deleteCreatedEvents(startTime, endTime);
  createEvents(startTime, endTime, originalEvents);
}
