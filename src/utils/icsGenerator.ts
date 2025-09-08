// Utility functions for generating ICS calendar files

export interface CalendarEvent {
  showName: string;
  showDate: string; // YYYY-MM-DD format
  showStartTime: string; // HH:MM format
  role: string;
  startTime?: string; // HH:MM format
  endTime?: string; // HH:MM format
  location?: string;
  description?: string;
}

export interface CalendarData {
  person: {
    name: string;
    email?: string;
  };
  shifts: CalendarEvent[];
  month: number;
  year: number;
}

// Convert date and time to ICS format (YYYYMMDDTHHMMSS) for local timezone
function formatICSDateTime(date: string, time: string): string {
  const [year, month, day] = date.split('-');
  const [hours, minutes] = time.split(':');
  
  // Format as local time without timezone conversion
  const paddedMonth = month.padStart(2, '0');
  const paddedDay = day.padStart(2, '0');
  const paddedHours = hours.padStart(2, '0');
  const paddedMinutes = minutes.padStart(2, '0');
  
  return `${year}${paddedMonth}${paddedDay}T${paddedHours}${paddedMinutes}00`;
}

// Generate a unique ID for the event
function generateEventId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Escape special characters for ICS format
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

// Generate ICS file content
export function generateICSFile(data: CalendarData): string {
  const monthNames = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'
  ];
  
  const monthName = monthNames[data.month - 1];
  const calendarName = `${data.person.name} - ${monthName} ${data.year} - Capitole Gent`;
  
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Capitole Gent//Staff Calendar//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSText(calendarName)}`,
    'X-WR-TIMEZONE:Europe/Brussels',
    'X-WR-CALDESC:Toegewezen diensten voor Capitole Gent',
  ].join('\r\n');

  // Add timezone information
  icsContent += '\r\n' + [
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Brussels',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n');

  // Add events
  for (const shift of data.shifts) {
    const eventId = generateEventId();
    const startTime = shift.startTime || shift.showStartTime;
    
    // Use the provided end time (already calculated as show start time + 3 hours)
    const endTime = shift.endTime || startTime;
    
    const dtStart = formatICSDateTime(shift.showDate, startTime);
    const dtEnd = endTime ? formatICSDateTime(shift.showDate, endTime) : formatICSDateTime(shift.showDate, startTime);
    
    const summary = `${escapeICSText(shift.role)} - ${escapeICSText(shift.showName)}`;
    const description = escapeICSText(shift.description || `${shift.role} voor ${shift.showName}`);
    const location = escapeICSText(shift.location || 'Capitole Gent');
    
    icsContent += '\r\n' + [
      'BEGIN:VEVENT',
      `UID:${eventId}@capitole-gent.be`,
      `DTSTART;TZID=Europe/Brussels:${dtStart}`,
      `DTEND;TZID=Europe/Brussels:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      'END:VEVENT',
    ].join('\r\n');
  }

  icsContent += '\r\nEND:VCALENDAR';
  
  return icsContent;
}

// Download ICS file
export function downloadICSFile(data: CalendarData): void {
  const icsContent = generateICSFile(data);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  
  const monthNames = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'
  ];
  
  const monthName = monthNames[data.month - 1];
  const filename = `${data.person.name.replace(/\s+/g, '_')}_${monthName}_${data.year}_Capitole.ics`;
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
