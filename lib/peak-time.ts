// Peak hours are 3:00pm–9:00pm. Both 30 and 60-minute sessions are bookable at any
// time (60-minute sessions must start on the hour) — peak hours just get a visual
// highlight and a nudge to share/keep it short so more residents get a turn.
const PEAK_START_MINUTES = 15 * 60 // 3:00pm
const PEAK_END_MINUTES = 21 * 60 // 9:00pm

export function isPeakTime(startTime: string): boolean {
  const [hours, minutes] = startTime.split(":").map(Number)
  const total = hours * 60 + minutes
  return total >= PEAK_START_MINUTES && total < PEAK_END_MINUTES
}
