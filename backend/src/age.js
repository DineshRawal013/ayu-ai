// Exact age calculation (carried over from the original age-calculator backend,
// extended to accept an optional birth time).

function calculateAgeDetailed(dateOfBirth, now = new Date()) {
  const dob = new Date(dateOfBirth);

  if (Number.isNaN(dob.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }
  if (dob > now) {
    throw new Error("Date of birth cannot be in the future.");
  }

  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();

  if (days < 0) {
    months -= 1;
    const previousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += previousMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMs = now.getTime() - dob.getTime();
  const totalSeconds = Math.floor(totalMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  // Next birthday countdown
  let next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
  if (next <= now) next = new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate());
  const daysToBirthday = Math.ceil((next - now) / 86400000);

  return {
    years,
    months,
    days,
    decimalYears: Number((totalMs / (365.2425 * 86400000)).toFixed(3)),
    totalDays,
    totalHours,
    totalMinutes,
    totalSeconds,
    daysToBirthday,
    dateOfBirth: dob.toISOString().split("T")[0],
    currentDateTime: now.toISOString()
  };
}

module.exports = { calculateAgeDetailed };
