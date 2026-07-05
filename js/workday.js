(function () {
  'use strict';

  const ShiftType = {
    AUTO: 'auto', MORNING: 'morning', MORNING_OT: 'morning_ot', EARLY: 'early',
    AFTERNOON: 'afternoon', AFTERNOON_OT: 'afternoon_ot', NIGHT: 'night', NIGHT_OT: 'night_ot',
    YOUNG: 'young', HOLIDAY: 'holiday',
    HOLIDAY_MORNING_1730: 'holiday_morning_1730', HOLIDAY_MORNING_2000: 'holiday_morning_2000',
    HOLIDAY_AFTERNOON_2200: 'holiday_afternoon_2200', HOLIDAY_AFTERNOON_OT: 'holiday_afternoon_ot',
    HOLIDAY_NIGHT_0530: 'holiday_night_0530', HOLIDAY_NIGHT_0800: 'holiday_night_0800',
    isHolidayOff(s) { return s === ShiftType.HOLIDAY; },
    isHolidayWork(s) { return s != null && s.startsWith('holiday_'); },
  };

  const DayStatus = { WORK: 'work', LEAVE: 'leave', ABSENT: 'absent', SICK: 'sick', HOLIDAY: 'holiday' };
  const STATUS_LABELS = { work: 'ทำงาน', leave: 'ลา', absent: 'ขาด', sick: 'ป่วย', holiday: 'วันหยุด' };

  const SHIFT_LABELS = {
    auto: 'ตรวจจับอัตโนมัติ', morning: 'กะเช้า D (08:00-17:30)', morning_ot: 'OT กะเช้า (08:00-20:00)',
    early: 'กะ A (06:00-14:00)', afternoon: 'กะ B (14:00-22:00)', afternoon_ot: 'OT กะ B (14:00-24:00)',
    night: 'กะดึก N (20:00-05:30)', night_ot: 'OT กะดึก (20:00-08:00)', young: 'กะ C (22:00-06:00)',
    holiday: 'วันหยุด (ไม่ทำงาน)', holiday_morning_1730: 'วันหยุด กะเช้า (เลิก 17:30)',
    holiday_morning_2000: 'OT วันหยุด กะเช้า (เลิก 20:00)', holiday_afternoon_2200: 'วันหยุด กะ B (เลิก 22:00)',
    holiday_afternoon_ot: 'OT วันหยุด กะ B (เลิก 24:00)', holiday_night_0530: 'วันหยุด กะดึก (เลิก 05:30)',
    holiday_night_0800: 'OT วันหยุด กะดึก (เลิก 08:00)',
  };

  const ALL_SHIFT_VALUES = [
    ShiftType.AUTO, ShiftType.MORNING, ShiftType.MORNING_OT, ShiftType.EARLY,
    ShiftType.AFTERNOON, ShiftType.AFTERNOON_OT, ShiftType.NIGHT, ShiftType.NIGHT_OT,
    ShiftType.YOUNG, ShiftType.HOLIDAY, ShiftType.HOLIDAY_MORNING_1730,
    ShiftType.HOLIDAY_MORNING_2000, ShiftType.HOLIDAY_AFTERNOON_2200,
    ShiftType.HOLIDAY_AFTERNOON_OT, ShiftType.HOLIDAY_NIGHT_0530, ShiftType.HOLIDAY_NIGHT_0800,
  ];

  // D, N, A, B, C (+ OT ของแต่ละกะ) — 3 กะ และ 4 หยุด 2 ได้ค่ากะ 165/วัน
  const SHIFT_ALLOWANCE_SHIFTS = [
    ShiftType.MORNING, ShiftType.MORNING_OT,           // D กะเช้า
    ShiftType.EARLY,                                   // A
    ShiftType.AFTERNOON, ShiftType.AFTERNOON_OT,       // B
    ShiftType.NIGHT, ShiftType.NIGHT_OT,               // N
    ShiftType.YOUNG,                                   // C
    ShiftType.HOLIDAY_MORNING_1730, ShiftType.HOLIDAY_MORNING_2000,
    ShiftType.HOLIDAY_AFTERNOON_2200, ShiftType.HOLIDAY_AFTERNOON_OT,
    ShiftType.HOLIDAY_NIGHT_0530, ShiftType.HOLIDAY_NIGHT_0800,
  ];

  const NIGHT_MEAL_SHIFTS = [ShiftType.NIGHT, ShiftType.YOUNG, ShiftType.HOLIDAY_NIGHT_0530];
  const NIGHT_OT_MILK_SHIFTS = [ShiftType.NIGHT_OT, ShiftType.HOLIDAY_NIGHT_0800];

  function getShiftLabel(shiftType) { return SHIFT_LABELS[shiftType] || SHIFT_LABELS.auto; }
  function getStatusLabel(status) { return STATUS_LABELS[status] || status; }

  class WorkDayRecord {
    constructor(date, checkIn, checkOut, note, shiftType, status, lateMinutes) {
      this.date = date;
      this.checkIn = checkIn || '';
      this.checkOut = checkOut || '';
      this.note = note || '';
      this.shiftType = shiftType && shiftType.length > 0 ? shiftType : ShiftType.AUTO;
      this.status = status || DayStatus.WORK;
      this.lateMinutes = lateMinutes || 0;
    }
    hasCheckIn() { return this.checkIn.length > 0; }
    hasCheckOut() { return this.checkOut.length > 0; }
    hasNote() { return this.note.length > 0; }
    isNonWorkStatus() {
      return this.status === DayStatus.LEAVE || this.status === DayStatus.ABSENT
        || this.status === DayStatus.SICK || this.status === DayStatus.HOLIDAY;
    }
    hasContent() {
      if (this.isNonWorkStatus()) return true;
      return this.shiftType === ShiftType.HOLIDAY || this.hasCheckIn() || this.hasCheckOut() || this.hasNote();
    }
    isHolidayOff() { return this.status === DayStatus.HOLIDAY || this.shiftType === ShiftType.HOLIDAY; }
    hasCompleteWorkTime() {
      if (this.isNonWorkStatus()) return false;
      if (this.shiftType === ShiftType.HOLIDAY) return true;
      return this.hasCheckIn() && this.hasCheckOut();
    }
    isCountableWorkDay() {
      if (this.isNonWorkStatus()) return false;
      if (this.shiftType === ShiftType.HOLIDAY) return false;
      return this.hasCompleteWorkTime();
    }
    hasDiligenceViolation() {
      if (this.lateMinutes > 0) return true;
      return this.status === DayStatus.LEAVE || this.status === DayStatus.ABSENT || this.status === DayStatus.SICK;
    }
    toJSON() {
      return {
        date: this.date, checkIn: this.checkIn, checkOut: this.checkOut, note: this.note,
        shiftType: this.shiftType, status: this.status, lateMinutes: this.lateMinutes,
      };
    }
    static fromJSON(obj) {
      return new WorkDayRecord(
        obj.date, obj.checkIn || '', obj.checkOut || '', obj.note || '',
        obj.shiftType || ShiftType.AUTO, obj.status || DayStatus.WORK, obj.lateMinutes || 0
      );
    }
  }

  class EmployeeProfile {
    constructor(data) {
      data = data || {};
      this.employeeId = data.employeeId || '';
      this.firstName = data.firstName || '';
      this.lastName = data.lastName || '';
      this.department = data.department || '';
      this.startDate = data.startDate || '';
      this.startDate4Off2 = data.startDate4Off2 || '';
      this.scheduleType = data.scheduleType || '5off2';
    }
    get fullName() { return (this.firstName + ' ' + this.lastName).trim(); }
    isComplete() { return this.startDate.length > 0; }
    getScheduleStartDate() {
      if (this.scheduleType === '4off2' && this.startDate4Off2) return this.startDate4Off2;
      return this.startDate;
    }
    toJSON() {
      return {
        employeeId: this.employeeId, firstName: this.firstName, lastName: this.lastName,
        department: this.department, startDate: this.startDate, startDate4Off2: this.startDate4Off2,
        scheduleType: this.scheduleType,
      };
    }
    static fromJSON(obj) { return new EmployeeProfile(obj); }
  }

  function parseDateKey(dateKey) {
    const p = dateKey.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function todayDateKey() { return formatDateKey(new Date()); }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function daysInMonthOf(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function daysBetween(startKey, endKey) {
    const s = parseDateKey(startKey);
    const e = parseDateKey(endKey);
    return Math.round((e - s) / (24 * 60 * 60 * 1000));
  }

  function enumerateDateKeys(startKey, endKey) {
    const keys = [];
    let d = parseDateKey(startKey);
    const end = parseDateKey(endKey);
    while (d <= end) {
      keys.push(formatDateKey(d));
      d = addDays(d, 1);
    }
    return keys;
  }

  function getPayDate(periodEnd) {
    const pay = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 10);
    while (pay.getDay() === 0 || pay.getDay() === 6) pay.setDate(pay.getDate() + 1);
    return pay;
  }

  function getPayPeriods(startDateKey, upToDate) {
    if (!startDateKey) return [];
    const periods = [];
    let periodStart = parseDateKey(startDateKey);
    const limit = upToDate || new Date();
    let index = 1;
    while (periodStart <= limit) {
      const length = daysInMonthOf(periodStart);
      const periodEnd = addDays(periodStart, length - 1);
      const payDate = getPayDate(periodEnd);
      periods.push({
        index: index,
        startKey: formatDateKey(periodStart),
        endKey: formatDateKey(periodEnd),
        startDate: new Date(periodStart),
        endDate: new Date(periodEnd),
        payDate: payDate,
        payDateKey: formatDateKey(payDate),
        daysInPeriod: length,
      });
      periodStart = addDays(periodEnd, 1);
      index++;
    }
    return periods;
  }

  function getPayPeriodForDate(profile, dateKey) {
    if (!profile || !profile.startDate) return null;
    const periods = getPayPeriods(profile.startDate, parseDateKey(dateKey));
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      if (dateKey >= p.startKey && dateKey <= p.endKey) return p;
    }
    return null;
  }

  function formatPeriodLabel(period) {
    const s = parseDateKey(period.startKey).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    const e = parseDateKey(period.endKey).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const pay = period.payDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    return s + ' – ' + e + ' (จ่าย ' + pay + ')';
  }

  function is4Off2RestDay(dateKey, profile) {
    if (!profile || profile.scheduleType !== '4off2') return false;
    const scheduleStartDate = profile.getScheduleStartDate ? profile.getScheduleStartDate() : profile.startDate;
    if (!scheduleStartDate) return false;
    const dayIndex = daysBetween(scheduleStartDate, dateKey);
    if (dayIndex < 0) return false;
    return (dayIndex % 6) >= 4;
  }

  function isWeekend(dateKey) {
    const day = parseDateKey(dateKey).getDay();
    return day === 0 || day === 6;
  }

  function currentTime() {
    const now = new Date();
    return formatTime(now.getHours(), now.getMinutes());
  }

  function formatTime(hour, minute) {
    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  }

  function formatDisplayDate(dateKey) {
    return parseDateKey(dateKey).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatDisplayDateToday() {
    return new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatMonthYear(year, month) {
    return new Date(year, month, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  }

  function parseTimeOrNow(timeText) {
    if (timeText && timeText.length > 0) {
      const parts = timeText.split(':');
      if (parts.length >= 2) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(h) && !isNaN(m)) return [h, m];
      }
    }
    const now = new Date();
    return [now.getHours(), now.getMinutes()];
  }

  function parseHour(timeText) { return parseTimeOrNow(timeText)[0]; }

  function toMinutesOfDay(timeText) {
    const p = parseTimeOrNow(timeText);
    return p[0] * 60 + p[1];
  }

  function minutesFromCheckIn(checkIn, checkOut) {
    const inMin = toMinutesOfDay(checkIn);
    const outMin = toMinutesOfDay(checkOut);
    if (outMin >= inMin) return outMin - inMin;
    return (24 * 60 - inMin) + outMin;
  }

  function calculateWorkMinutes(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const diff = minutesFromCheckIn(checkIn, checkOut);
    return diff > 0 ? diff : 0;
  }

  function calculateDuration(checkIn, checkOut) {
    const minutes = calculateWorkMinutes(checkIn, checkOut);
    if (minutes <= 0) return '';
    return Math.floor(minutes / 60) + ' ชม. ' + (minutes % 60) + ' น.';
  }

  function formatDurationLabel(duration) { return duration ? 'ชั่วโมงทำงาน: ' + duration : ''; }

  function calculateOtMinutes(checkIn, checkOut, standardEndFromStart) {
    return Math.max(0, minutesFromCheckIn(checkIn, checkOut) - standardEndFromStart);
  }

  function isCheckOutAfterCheckIn(checkIn, checkOut) {
    if (!checkIn || !checkOut) return false;
    return minutesFromCheckIn(checkIn, checkOut) > 0;
  }

  function toTimeInputValue(timeText) {
    if (!timeText) return '';
    const p = parseTimeOrNow(timeText);
    return formatTime(p[0], p[1]);
  }

  function dateKeyFromParts(year, month, dayOfMonth) {
    return formatDateKey(new Date(year, month, dayOfMonth));
  }

  function detectNightEnd(checkOut, workedMinutes, young) {
    if (young) return ShiftType.YOUNG;
    if (!checkOut) return ShiftType.NIGHT;
    if (workedMinutes >= 11 * 60 || parseHour(checkOut) >= 7) return ShiftType.NIGHT_OT;
    return ShiftType.NIGHT;
  }

  function standardEndMinutes(shift) {
    const map = {};
    map[ShiftType.MORNING] = 17 * 60 + 30;
    map[ShiftType.HOLIDAY_MORNING_1730] = 17 * 60 + 30;
    map[ShiftType.MORNING_OT] = 20 * 60;
    map[ShiftType.HOLIDAY_MORNING_2000] = 20 * 60;
    map[ShiftType.EARLY] = 14 * 60;
    map[ShiftType.AFTERNOON] = 22 * 60;
    map[ShiftType.HOLIDAY_AFTERNOON_2200] = 22 * 60;
    map[ShiftType.AFTERNOON_OT] = 24 * 60;
    map[ShiftType.HOLIDAY_AFTERNOON_OT] = 24 * 60;
    map[ShiftType.NIGHT] = 24 * 60 + 5 * 60 + 30;
    map[ShiftType.HOLIDAY_NIGHT_0530] = 24 * 60 + 5 * 60 + 30;
    map[ShiftType.NIGHT_OT] = 24 * 60 + 8 * 60;
    map[ShiftType.HOLIDAY_NIGHT_0800] = 24 * 60 + 8 * 60;
    map[ShiftType.YOUNG] = 24 * 60 + 6 * 60;
    return map[shift] != null ? map[shift] : 17 * 60 + 30;
  }

  function getBuiltInOtHours(shift) {
    if (shift === ShiftType.MORNING_OT || shift === ShiftType.HOLIDAY_MORNING_2000
      || shift === ShiftType.NIGHT_OT || shift === ShiftType.HOLIDAY_NIGHT_0800) return 2.5;
    if (shift === ShiftType.AFTERNOON_OT || shift === ShiftType.HOLIDAY_AFTERNOON_OT) return 2.0;
    return 0;
  }

  const CompanyWagePolicy = {
    DAILY_WAGE: 400,
    SPECIAL_ALLOWANCE: 12.5,
    SHIFT_ALLOWANCE: 165,
    NIGHT_MEAL_ALLOWANCE: 65,
    NIGHT_MILK_ALLOWANCE: 65,
    HOUSING_MONTHLY: 3000,
    HOURLY_RATE: 50,
    REGULAR_OT_MULTIPLIER: 1.5,
    HOLIDAY_WORK_MULTIPLIER: 2.0,
    HOLIDAY_OT_MULTIPLIER: 3.0,
    DILIGENCE_FIRST: 500,
    DILIGENCE_INCREMENT: 100,
    DILIGENCE_MAX: 1000,

    resolveShift(record) {
      const shift = record.shiftType;
      if (shift && shift.length > 0 && shift !== ShiftType.AUTO) return shift;
      if (record.hasCheckIn()) return this.detectShiftFromTime(record.checkIn, record.checkOut);
      return ShiftType.MORNING;
    },

    detectShiftFromTime(checkIn, checkOut) {
      if (!checkIn) return ShiftType.MORNING;
      const startHour = parseHour(checkIn);
      const worked = checkOut ? minutesFromCheckIn(checkIn, checkOut) : 0;
      if (startHour >= 22) return detectNightEnd(checkOut, worked, true);
      if (startHour >= 19 || startHour < 6) return detectNightEnd(checkOut, worked, false);
      if (startHour >= 13 && startHour < 16) return worked > 8 * 60 + 30 ? ShiftType.AFTERNOON_OT : ShiftType.AFTERNOON;
      if (startHour >= 5 && startHour < 7) return ShiftType.EARLY;
      if (worked >= 11 * 60 + 30) return ShiftType.MORNING_OT;
      return ShiftType.MORNING;
    },

    getShiftAllowance(shift, profile) {
      if (!profile || (profile.scheduleType !== '4off2' && profile.scheduleType !== '5off2')) return 0;
      if (SHIFT_ALLOWANCE_SHIFTS.indexOf(shift) < 0) return 0;
      // 4 หยุด 2: ได้ค่ากะทั้งกะเช้า (D) และกะดึก (N,A,B,C)
      return this.SHIFT_ALLOWANCE;
    },

    getShiftAllowanceLabel(shift) {
      if (shift === ShiftType.MORNING || shift === ShiftType.MORNING_OT
        || shift === ShiftType.HOLIDAY_MORNING_1730 || shift === ShiftType.HOLIDAY_MORNING_2000) {
        return 'ค่ากะเช้า (D)';
      }
      return 'ค่ากะ';
    },

    getNightMealAllowance(shift) {
      return NIGHT_MEAL_SHIFTS.indexOf(shift) >= 0 ? this.NIGHT_MEAL_ALLOWANCE : 0;
    },

    getNightMilkAllowance(shift, record) {
      if (NIGHT_OT_MILK_SHIFTS.indexOf(shift) >= 0) return this.NIGHT_MILK_ALLOWANCE;
      if (NIGHT_MEAL_SHIFTS.indexOf(shift) >= 0 && this.calculateOtPay(record, shift) > 0) {
        return this.NIGHT_MILK_ALLOWANCE;
      }
      return 0;
    },

    getDailyHousingAllowance(dateKey, profile) {
      const period = getPayPeriodForDate(profile, dateKey);
      if (!period) return 0;
      return this.HOUSING_MONTHLY / period.daysInPeriod;
    },

    calculateOtPay(record, shift) {
      if (!record.hasCompleteWorkTime()) return 0;
      let otHours = getBuiltInOtHours(shift);
      const startMin = toMinutesOfDay(record.checkIn);
      const standardEnd = standardEndMinutes(shift);
      let standardDuration = standardEnd - startMin;
      if (standardDuration < 0) standardDuration += 24 * 60;
      otHours += calculateOtMinutes(record.checkIn, record.checkOut, standardDuration) / 60.0;
      if (otHours <= 0) return 0;
      const multiplier = ShiftType.isHolidayWork(shift) ? this.HOLIDAY_OT_MULTIPLIER : this.REGULAR_OT_MULTIPLIER;
      return otHours * this.HOURLY_RATE * multiplier;
    },

    calculateDailyPay(record, profile) {
      if (record.isNonWorkStatus() || !record.hasCompleteWorkTime()) return 0;
      const shift = this.resolveShift(record);
      if (shift === ShiftType.HOLIDAY) return 0;
      let dailyWage = this.DAILY_WAGE;
      let special = this.SPECIAL_ALLOWANCE;
      if (ShiftType.isHolidayWork(shift)) {
        dailyWage *= this.HOLIDAY_WORK_MULTIPLIER;
        special *= this.HOLIDAY_WORK_MULTIPLIER;
      }
      let total = dailyWage + special;
      total += this.getShiftAllowance(shift, profile);
      total += this.getNightMealAllowance(shift);
      total += this.getNightMilkAllowance(shift, record);
      total += this.getDailyHousingAllowance(record.date, profile);
      total += this.calculateOtPay(record, shift);
      return total;
    },

    calculateDailyBreakdown(record, profile) {
      if (record.isNonWorkStatus()) return { total: 0, lines: [getStatusLabel(record.status)] };
      if (!record.hasCompleteWorkTime()) return { total: 0, lines: [] };
      const shift = this.resolveShift(record);
      if (shift === ShiftType.HOLIDAY) return { total: 0, lines: [getShiftLabel(ShiftType.HOLIDAY)] };
      const isHoliday = ShiftType.isHolidayWork(shift);
      const dailyWage = isHoliday ? this.DAILY_WAGE * 2 : this.DAILY_WAGE;
      const special = isHoliday ? this.SPECIAL_ALLOWANCE * 2 : this.SPECIAL_ALLOWANCE;
      const shiftAllow = this.getShiftAllowance(shift, profile);
      const meal = this.getNightMealAllowance(shift);
      const otPay = this.calculateOtPay(record, shift);
      const milk = this.getNightMilkAllowance(shift, record);
      const housing = this.getDailyHousingAllowance(record.date, profile);
      const total = dailyWage + special + shiftAllow + meal + milk + housing + otPay;
      const lines = ['กะงาน: ' + getShiftLabel(shift)];
      lines.push('ค่าจ้างรายวัน: ' + formatMoney(dailyWage));
      lines.push('เงินพิเศษ: ' + formatMoney(special));
      if (shiftAllow > 0) lines.push(this.getShiftAllowanceLabel(shift) + ': ' + formatMoney(shiftAllow));
      if (meal > 0) lines.push('ค่าข้าวกะดึก: ' + formatMoney(meal));
      if (milk > 0) lines.push('ค่านมกะดึก (OT): ' + formatMoney(milk));
      if (housing > 0) lines.push('ค่าเช่าบ้าน (รายวัน): ' + formatMoney(housing));
      if (otPay > 0) lines.push('ค่า OT: ' + formatMoney(otPay));
      if (record.lateMinutes > 0) lines.push('สาย: ' + record.lateMinutes + ' นาที');
      lines.push('รายได้วันนี้: ' + formatMoney(total));
      return { total: total, lines: lines };
    },

    calcDiligenceBonus(period, periodIndex, records, profile) {
      if (!profile || !profile.startDate) return 0;
      const today = todayDateKey();
      if (today < period.endKey) return 0;
      const periodKeys = enumerateDateKeys(period.startKey, period.endKey);
      const recordMap = {};
      records.forEach(function (r) { recordMap[r.date] = r; });
      for (let i = 0; i < periodKeys.length; i++) {
        const r = recordMap[periodKeys[i]];
        if (r && r.hasDiligenceViolation()) return 0;
      }
      const amount = Math.min(
        this.DILIGENCE_FIRST + (periodIndex - 1) * this.DILIGENCE_INCREMENT,
        this.DILIGENCE_MAX
      );
      return amount;
    },
  };

  function calculatePay(record, profile) {
    return CompanyWagePolicy.calculateDailyPay(record, profile);
  }

  function sumPay(records, profile) {
    let total = 0;
    for (let i = 0; i < records.length; i++) total += calculatePay(records[i], profile);
    return total;
  }

  function sumHousing(records, profile) {
    let total = 0;
    for (let i = 0; i < records.length; i++) {
      if (records[i].isCountableWorkDay()) {
        total += CompanyWagePolicy.getDailyHousingAllowance(records[i].date, profile);
      }
    }
    return total;
  }

  function countWorkDays(records) {
    let count = 0;
    for (let i = 0; i < records.length; i++) if (records[i].isCountableWorkDay()) count++;
    return count;
  }

  function sumWorkHours(records) {
    let total = 0;
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (r.hasCompleteWorkTime() && !r.isHolidayOff()) {
        total += calculateWorkMinutes(r.checkIn, r.checkOut) / 60.0;
      }
    }
    return total;
  }

  function formatMoney(amount) {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บาท';
  }

  function formatHours(hours) {
    const totalMinutes = Math.round(hours * 60);
    return Math.floor(totalMinutes / 60) + ' ชม. ' + (totalMinutes % 60) + ' น.';
  }

  function formatPayLine(record, profile) {
    if (record.isNonWorkStatus()) return getStatusLabel(record.status);
    if (record.isHolidayOff()) return 'วันหยุด';
    if (!record.isCountableWorkDay()) return '';
    return calculateDuration(record.checkIn, record.checkOut) + ' = ' + formatMoney(calculatePay(record, profile));
  }

  function formatPayBreakdown(record, profile) {
    if (record.isNonWorkStatus()) return getStatusLabel(record.status);
    const bd = CompanyWagePolicy.calculateDailyBreakdown(record, profile);
    return bd.lines.join('\n');
  }

  function calculatePeriodSummary(period, periodIndex, allRecords, profile) {
    const records = allRecords.filter(function (r) {
      return r.date >= period.startKey && r.date <= period.endKey;
    });
    const dailyPay = sumPay(records, profile);
    const housing = sumHousing(records, profile);
    const diligence = CompanyWagePolicy.calcDiligenceBonus(period, periodIndex, allRecords, profile);
    const workDays = countWorkDays(records);
    const hours = sumWorkHours(records);
    const total = dailyPay + diligence;
    return {
      records: records, workDays: workDays, hours: hours,
      dailyPay: dailyPay, housing: housing, diligence: diligence, total: total,
    };
  }

  const STORAGE_KEY = 'work_day_records';
  const PROFILE_KEY = 'employee_profile';

  class WorkDayStorage {
    getAllRecords() {
      try {
        const array = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const records = array.map(function (obj) { return WorkDayRecord.fromJSON(obj); });
        records.sort(function (a, b) { return b.date.localeCompare(a.date); });
        return records;
      } catch (e) { return []; }
    }
    getRecordForDate(date) {
      const records = this.getAllRecords();
      for (let i = 0; i < records.length; i++) if (records[i].date === date) return records[i];
      return null;
    }
    saveRecord(record) {
      if (!record.hasContent()) { this.deleteRecord(record.date); return; }
      const records = this.getAllRecords();
      let found = false;
      for (let i = 0; i < records.length; i++) {
        if (records[i].date === record.date) { records[i] = record; found = true; break; }
      }
      if (!found) records.push(record);
      this.saveAll(records);
    }
    deleteRecord(date) {
      this.saveAll(this.getAllRecords().filter(function (r) { return r.date !== date; }));
    }
    saveAll(records) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records.map(function (r) { return r.toJSON(); })));
    }
    importRecords(jsonString) {
      const array = JSON.parse(jsonString);
      if (!Array.isArray(array)) throw new Error('invalid');
      this.saveAll(array.map(function (obj) { return WorkDayRecord.fromJSON(obj); }));
      return array.length;
    }
    exportRecords() {
      return JSON.stringify(this.getAllRecords().map(function (r) { return r.toJSON(); }), null, 2);
    }
    getRecordsInRange(startKey, endKey) {
      return this.getAllRecords().filter(function (r) {
        return r.date >= startKey && r.date <= endKey;
      });
    }
  }

  class ProfileStorage {
    get() {
      try {
        const raw = localStorage.getItem(PROFILE_KEY);
        return raw ? EmployeeProfile.fromJSON(JSON.parse(raw)) : new EmployeeProfile();
      } catch (e) { return new EmployeeProfile(); }
    }
    save(profile) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile.toJSON()));
    }
  }

  const TimesheetDB = {
    DB_NAME: 'workday_files',
    STORE: 'timesheets',

    open() {
      return new Promise(function (resolve, reject) {
        const req = indexedDB.open(TimesheetDB.DB_NAME, 1);
        req.onupgradeneeded = function (e) {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(TimesheetDB.STORE)) {
            db.createObjectStore(TimesheetDB.STORE, { keyPath: 'monthKey' });
          }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    },

    async save(monthKey, file) {
      const data = await new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const db = await TimesheetDB.open();
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(TimesheetDB.STORE, 'readwrite');
        tx.objectStore(TimesheetDB.STORE).put({
          monthKey: monthKey,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: data,
          uploadedAt: new Date().toISOString(),
        });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    },

    async put(record) {
      const db = await TimesheetDB.open();
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(TimesheetDB.STORE, 'readwrite');
        tx.objectStore(TimesheetDB.STORE).put(record);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    },

    async get(monthKey) {
      const db = await TimesheetDB.open();
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(TimesheetDB.STORE, 'readonly');
        const req = tx.objectStore(TimesheetDB.STORE).get(monthKey);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    },

    async getAll() {
      const db = await TimesheetDB.open();
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(TimesheetDB.STORE, 'readonly');
        const req = tx.objectStore(TimesheetDB.STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    },

    async delete(monthKey) {
      const db = await TimesheetDB.open();
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(TimesheetDB.STORE, 'readwrite');
        tx.objectStore(TimesheetDB.STORE).delete(monthKey);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    },
  };

  function buildMonthGrid(year, month, recordedDates, selectedDateKey, todayKey, profile) {
    const startWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ empty: true });
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKeyFromParts(year, month, day);
      cells.push({
        empty: false, dateKey: key, day,
        isToday: key === todayKey,
        isSelected: key === selectedDateKey,
        hasRecord: recordedDates.has(key),
        is4Off2Rest: is4Off2RestDay(key, profile),
        isWeekend: isWeekend(key),
      });
    }
    return cells;
  }

  function initApp() {
    const storage = new WorkDayStorage();
    const profileStorage = new ProfileStorage();
    let profile = profileStorage.get();

    const state = {
      view: 'home',
      detailDateKey: null,
      calYear: new Date().getFullYear(),
      calMonth: new Date().getMonth(),
      selectedDateKey: todayDateKey(),
      selectedPeriodIndex: -1,
      selectedUploadMonth: '',
    };

    function $(id) { return document.getElementById(id); }

    const views = {
      home: $('viewHome'), calendar: $('viewCalendar'), dayDetail: $('viewDayDetail'),
      profile: $('viewProfile'), documents: $('viewDocuments'), documentsUpload: $('viewDocumentsUpload'), info: $('viewInfo'),
    };

    const titles = {
      home: 'หน้าหลัก', calendar: 'ปฏิทิน', dayDetail: 'บันทึกรายละเอียดวัน',
      profile: 'โปรไฟล์', documents: 'เอกสาร', documentsUpload: 'หน้าส่งรูป / เอกสาร', info: 'ข้อมูล',
    };

    function showToast(msg) {
      const el = $('toast');
      el.textContent = msg;
      el.classList.remove('hidden');
      clearTimeout(showToast._timer);
      showToast._timer = setTimeout(function () { el.classList.add('hidden'); }, 2500);
    }

    function getPeriods() {
      if (!profile.isComplete()) return [];
      return getPayPeriods(profile.startDate, new Date());
    }

    function getSelectedPeriod() {
      const periods = getPeriods();
      if (periods.length === 0) return null;
      if (state.selectedPeriodIndex < 0 || state.selectedPeriodIndex >= periods.length) {
        const today = todayDateKey();
        for (let i = periods.length - 1; i >= 0; i--) {
          if (today >= periods[i].startKey) return periods[i];
        }
        return periods[periods.length - 1];
      }
      return periods[state.selectedPeriodIndex];
    }

    function navigate(view, dateKey) {
      state.view = view;
      if (dateKey) state.detailDateKey = dateKey;
      Object.keys(views).forEach(function (name) {
        views[name].classList.toggle('active', name === view);
      });
      document.querySelectorAll('.nav-item').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.view === view
          || (view === 'dayDetail' && btn.dataset.view === 'calendar'));
      });
      const isDetail = view === 'dayDetail' || view === 'documentsUpload';
      $('btnBack').classList.toggle('hidden', !isDetail);
      $('pageTitle').textContent = isDetail && state.detailDateKey && view !== 'documentsUpload'
        ? formatDisplayDate(state.detailDateKey) : (titles[view] || 'บันทึกวันทำงาน');
      document.querySelector('.bottom-nav').classList.toggle('hidden', isDetail);
      if (view === 'home') refreshHome();
      if (view === 'calendar') refreshCalendar();
      if (view === 'dayDetail') refreshDayDetail();
      if (view === 'profile') refreshProfile();
      if (view === 'documents') refreshDocuments();
      if (view === 'documentsUpload') refreshDocumentsUpload();
    }

    function populatePeriodSelect() {
      const select = $('periodSelect');
      const periods = getPeriods();
      select.innerHTML = '';
      if (periods.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'กรุณาตั้งค่าวันเริ่มงานในโปรไฟล์';
        select.appendChild(opt);
        select.disabled = true;
        return;
      }
      select.disabled = false;
      periods.forEach(function (p, i) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = 'รอบ ' + p.index + ': ' + formatPeriodLabel(p);
        select.appendChild(opt);
      });
      const current = getSelectedPeriod();
      if (current) {
        state.selectedPeriodIndex = current.index - 1;
        select.value = String(state.selectedPeriodIndex);
      }
    }

    function refreshHome() {
      populatePeriodSelect();
      const todayKey = todayDateKey();
      $('todayDate').textContent = formatDisplayDateToday();
      const record = storage.getRecordForDate(todayKey);
      $('todayCheckIn').textContent = record && record.hasCheckIn() ? record.checkIn : 'ยังไม่บันทึก';
      $('todayCheckOut').textContent = record && record.hasCheckOut() ? record.checkOut : 'ยังไม่บันทึก';
      if (record && record.isCountableWorkDay()) {
        $('todayDuration').textContent = formatDurationLabel(calculateDuration(record.checkIn, record.checkOut));
        $('todayDuration').classList.remove('hidden');
        $('todayWage').textContent = 'รายได้วันนี้: ' + formatMoney(calculatePay(record, profile));
        $('todayWage').classList.remove('hidden');
      } else {
        $('todayDuration').classList.add('hidden');
        $('todayWage').classList.add('hidden');
      }
      $('btnCheckIn').disabled = !!(record && record.hasCheckIn()) || !!(record && record.isNonWorkStatus());
      $('btnCheckOut').disabled = !(record && record.hasCheckIn()) || !!(record && record.hasCheckOut())
        || !!(record && record.isNonWorkStatus());

      const period = getSelectedPeriod();
      if (period) {
        const summary = calculatePeriodSummary(period, period.index, storage.getAllRecords(), profile);
        $('totalDays').textContent = summary.workDays + ' วัน';
        $('totalHours').textContent = formatHours(summary.hours);
        $('totalHousing').textContent = formatMoney(summary.housing);
        $('totalDiligence').textContent = formatMoney(summary.diligence);
        $('totalWage').textContent = formatMoney(summary.total);
        $('periodInfo').textContent = formatPeriodLabel(period) + ' | ' + period.daysInPeriod + ' วัน/รอบ';
        const breakdown = [
          'ค่าจ้าง+เบี้ย+OT+กะ: ' + formatMoney(summary.dailyPay - summary.housing),
          'ค่าเช่าบ้าน: ' + formatMoney(summary.housing),
          'เบี้ยขยัน: ' + formatMoney(summary.diligence),
        ];
        if (summary.diligence === 0 && todayDateKey() >= period.endKey) {
          breakdown.push('(ไม่ได้เบี้ยขยัน: มีลา/ขาด/ป่วย/สาย หรือรอบยังไม่ครบ)');
        } else if (summary.diligence === 0) {
          breakdown.push('(เบี้ยขยันจะคำนวณเมื่อครบรอบ ' + period.daysInPeriod + ' วัน)');
        }
        $('periodBreakdown').textContent = breakdown.join('\n');
        $('periodBreakdown').classList.remove('hidden');
      } else {
        $('totalDays').textContent = countWorkDays(storage.getAllRecords()) + ' วัน';
        $('totalHours').textContent = formatHours(sumWorkHours(storage.getAllRecords()));
        $('totalHousing').textContent = '0.00 บาท';
        $('totalDiligence').textContent = '0.00 บาท';
        $('totalWage').textContent = formatMoney(sumPay(storage.getAllRecords(), profile));
        $('periodInfo').textContent = 'ตั้งค่าวันเริ่มงานในโปรไฟล์เพื่อดูรายได้รายรอบ';
        $('periodBreakdown').classList.add('hidden');
      }

      const history = storage.getAllRecords().filter(function (r) { return r.date !== todayKey; });
      const period2 = getSelectedPeriod();
      const filteredHistory = period2
        ? history.filter(function (r) { return r.date >= period2.startKey && r.date <= period2.endKey; })
        : history.slice(0, 20);
      $('emptyHistory').classList.toggle('hidden', filteredHistory.length > 0);
      const list = $('historyList');
      list.innerHTML = '';
      filteredHistory.forEach(function (r) {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.addEventListener('click', function () { navigate('dayDetail', r.date); });
        const dateEl = document.createElement('p');
        dateEl.className = 'date';
        dateEl.textContent = formatDisplayDate(r.date);
        const detailEl = document.createElement('p');
        detailEl.className = 'muted';
        if (r.isNonWorkStatus()) detailEl.textContent = getStatusLabel(r.status);
        else if (r.isHolidayOff()) detailEl.textContent = 'วันหยุด';
        else if (r.isCountableWorkDay()) detailEl.textContent = r.checkIn + ' - ' + r.checkOut;
        else if (r.hasCheckIn()) detailEl.textContent = 'เข้างาน ' + r.checkIn;
        else detailEl.textContent = r.note || 'มีบันทึก';
        li.appendChild(dateEl);
        li.appendChild(detailEl);
        if (r.isCountableWorkDay() || r.isNonWorkStatus()) {
          const payEl = document.createElement('p');
          payEl.className = 'pay';
          payEl.textContent = formatPayLine(r, profile);
          li.appendChild(payEl);
        }
        list.appendChild(li);
      });
    }

    function getRecordedDates() {
      const dates = new Set();
      storage.getAllRecords().forEach(function (r) { if (r.hasContent()) dates.add(r.date); });
      return dates;
    }

    function refreshCalendar() {
      $('monthYear').textContent = formatMonthYear(state.calYear, state.calMonth);
      const hint = $('scheduleHint');
      if (profile.scheduleType === '4off2' && profile.startDate) {
        const scheduleStartDate = profile.getScheduleStartDate ? profile.getScheduleStartDate() : profile.startDate;
        hint.textContent = '4 หยุด 2: วันหยุดตามรอบ (สีแดง) นับจาก ' + formatDisplayDate(scheduleStartDate);
        hint.classList.remove('hidden');
      } else {
        hint.classList.add('hidden');
      }
      const grid = $('calendarGrid');
      grid.innerHTML = '';
      buildMonthGrid(state.calYear, state.calMonth, getRecordedDates(), state.selectedDateKey, todayDateKey(), profile)
        .forEach(function (cell) {
          if (cell.empty) {
            const empty = document.createElement('div');
            empty.className = 'cal-cell empty';
            grid.appendChild(empty);
            return;
          }
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cal-cell';
          if (cell.isToday) btn.classList.add('today');
          if (cell.isSelected) btn.classList.add('selected');
          if (cell.hasRecord) btn.classList.add('has-record');
          if (cell.is4Off2Rest) btn.classList.add('rest-4off2');
          else if (cell.isWeekend) btn.classList.add('weekend');
          btn.textContent = cell.day;
          btn.addEventListener('click', function () {
            state.selectedDateKey = cell.dateKey;
            refreshCalendar();
            updateSelectedDayDetail();
          });
          grid.appendChild(btn);
        });
      updateSelectedDayDetail();
    }

    function updateSelectedDayDetail() {
      const key = state.selectedDateKey;
      $('selectedDate').textContent = formatDisplayDate(key);
      const record = storage.getRecordForDate(key);
      const lines = [];
      if (profile.scheduleType === '4off2' && is4Off2RestDay(key, profile)) {
        lines.push('📅 วันหยุด 4-2 (ตามรอบ)');
      }
      if (!record || !record.hasContent()) {
        lines.push('ไม่มีการบันทึกในวันนี้');
        $('selectedDetail').textContent = lines.join('\n');
        return;
      }
      if (record.isNonWorkStatus()) {
        lines.push('สถานะ: ' + getStatusLabel(record.status));
        if (record.hasNote()) lines.push('โน้ต: ' + record.note);
        $('selectedDetail').textContent = lines.join('\n');
        return;
      }
      if (record.isHolidayOff()) {
        lines.push(getShiftLabel(ShiftType.HOLIDAY));
        $('selectedDetail').textContent = lines.join('\n');
        return;
      }
      if (record.hasCheckIn()) lines.push('เข้างาน ' + record.checkIn);
      if (record.hasCheckOut()) lines.push('ออกงาน ' + record.checkOut);
      if (record.isCountableWorkDay()) {
        lines.push(formatDurationLabel(calculateDuration(record.checkIn, record.checkOut)));
        lines.push(formatPayBreakdown(record, profile));
      }
      if (record.hasNote()) lines.push('บันทึก/โน้ต: ' + record.note);
      $('selectedDetail').textContent = lines.join('\n');
    }

    function setupShiftSelect() {
      const select = $('shiftSelect');
      select.innerHTML = '';
      ALL_SHIFT_VALUES.forEach(function (value) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = getShiftLabel(value);
        select.appendChild(opt);
      });
    }

    function updateDayDetailFieldsVisibility() {
      const status = $('statusSelect').value;
      const isWork = status === DayStatus.WORK;
      $('timeFields').classList.toggle('hidden', !isWork);
      $('shiftSelect').closest('.field').classList.toggle('hidden', !isWork);
    }

    function refreshDayDetail() {
      const dateKey = state.detailDateKey;
      if (!dateKey) return;
      $('dayDetailDate').textContent = formatDisplayDate(dateKey);
      const record = storage.getRecordForDate(dateKey);
      if (record) {
        $('statusSelect').value = record.status || DayStatus.WORK;
        $('editCheckIn').value = toTimeInputValue(record.checkIn);
        $('editCheckOut').value = toTimeInputValue(record.checkOut);
        $('editNote').value = record.note;
        $('editLate').value = record.lateMinutes || 0;
        $('shiftSelect').value = record.shiftType;
      } else {
        $('statusSelect').value = DayStatus.WORK;
        $('editCheckIn').value = '';
        $('editCheckOut').value = '';
        $('editNote').value = '';
        $('editLate').value = 0;
        $('shiftSelect').value = ShiftType.AUTO;
      }
      updateDayDetailFieldsVisibility();
      updatePreview();
      updateSavedPreview();
    }

    function buildPreviewRecord() {
      const dateKey = state.detailDateKey;
      const status = $('statusSelect').value;
      const shift = $('shiftSelect').value;
      const checkIn = $('editCheckIn').value || '';
      const checkOut = $('editCheckOut').value || '';
      const late = parseInt($('editLate').value, 10) || 0;
      return new WorkDayRecord(dateKey, checkIn, checkOut, '', shift, status, late);
    }

    function updatePreview() {
      const status = $('statusSelect').value;
      if (status !== DayStatus.WORK) {
        $('previewDuration').classList.add('hidden');
        $('previewWage').textContent = getStatusLabel(status);
        $('previewWage').classList.remove('hidden');
        return;
      }
      const preview = buildPreviewRecord();
      const checkIn = preview.checkIn;
      const checkOut = preview.checkOut;
      const duration = checkIn && checkOut ? calculateDuration(checkIn, checkOut) : '';
      if (duration || preview.shiftType === ShiftType.HOLIDAY) {
        $('previewDuration').textContent = duration ? formatDurationLabel(duration) : '';
        $('previewDuration').classList.toggle('hidden', !duration);
        $('previewWage').textContent = formatPayBreakdown(preview, profile);
        $('previewWage').classList.remove('hidden');
        return;
      }
      $('previewDuration').classList.add('hidden');
      $('previewWage').classList.add('hidden');
    }

    function updateSavedPreview() {
      const record = storage.getRecordForDate(state.detailDateKey);
      if (!record || !record.hasContent()) {
        $('savedPreviewCard').classList.add('hidden');
        return;
      }
      $('savedPreview').textContent = formatPayBreakdown(record, profile);
      $('savedPreviewCard').classList.remove('hidden');
    }

    function handleCheckIn() {
      const todayKey = todayDateKey();
      let record = storage.getRecordForDate(todayKey);
      if (record && record.isNonWorkStatus()) { showToast('วันนี้บันทึกเป็น ' + getStatusLabel(record.status)); return; }
      if (record && record.hasCheckIn()) { showToast('บันทึกเข้างานแล้ววันนี้'); return; }
      if (!record) record = new WorkDayRecord(todayKey, currentTime(), '', '', ShiftType.AUTO, DayStatus.WORK, 0);
      else record.checkIn = currentTime();
      storage.saveRecord(record);
      showToast('บันทึกเข้างานแล้ว');
      refreshHome();
    }

    function handleCheckOut() {
      const todayKey = todayDateKey();
      const record = storage.getRecordForDate(todayKey);
      if (!record || !record.hasCheckIn()) { showToast('กรุณาบันทึกเข้างานก่อน'); return; }
      if (record.hasCheckOut()) { showToast('บันทึกออกงานแล้ววันนี้'); return; }
      record.checkOut = currentTime();
      if (record.shiftType === ShiftType.AUTO) {
        record.shiftType = CompanyWagePolicy.detectShiftFromTime(record.checkIn, record.checkOut);
      }
      storage.saveRecord(record);
      showToast('บันทึกออกงานแล้ว');
      refreshHome();
    }

    function saveDayDetail() {
      const dateKey = state.detailDateKey;
      const status = $('statusSelect').value;
      const note = $('editNote').value.trim();
      if (status !== DayStatus.WORK) {
        storage.saveRecord(new WorkDayRecord(dateKey, '', '', note, ShiftType.AUTO, status, 0));
        showToast('บันทึกข้อมูลแล้ว');
        updateSavedPreview();
        updatePreview();
        return;
      }
      const shift = $('shiftSelect').value;
      const checkIn = $('editCheckIn').value || '';
      const checkOut = $('editCheckOut').value || '';
      const late = parseInt($('editLate').value, 10) || 0;
      if (shift === ShiftType.HOLIDAY) {
        storage.saveRecord(new WorkDayRecord(dateKey, '', '', note, shift, DayStatus.HOLIDAY, 0));
        showToast('บันทึกข้อมูลแล้ว');
        updateSavedPreview();
        return;
      }
      if (checkOut && !checkIn) { showToast('กรุณาบันทึกเข้างานก่อน'); return; }
      if (checkIn && checkOut && !isCheckOutAfterCheckIn(checkIn, checkOut)) {
        showToast('เวลาออกงานต้องหลังเวลาเข้างาน');
        return;
      }
      storage.saveRecord(new WorkDayRecord(dateKey, checkIn, checkOut, note, shift, DayStatus.WORK, late));
      showToast('บันทึกข้อมูลแล้ว');
      updateSavedPreview();
      updatePreview();
    }

    function clearDayDetail() {
      storage.deleteRecord(state.detailDateKey);
      $('statusSelect').value = DayStatus.WORK;
      $('editCheckIn').value = '';
      $('editCheckOut').value = '';
      $('editNote').value = '';
      $('editLate').value = 0;
      $('shiftSelect').value = ShiftType.AUTO;
      $('previewDuration').classList.add('hidden');
      $('previewWage').classList.add('hidden');
      $('savedPreviewCard').classList.add('hidden');
      updateDayDetailFieldsVisibility();
      showToast('ล้างข้อมูลแล้ว');
    }

    function refreshProfile() {
      $('profileEmployeeId').value = profile.employeeId;
      $('profileFirstName').value = profile.firstName;
      $('profileLastName').value = profile.lastName;
      $('profileDepartment').value = profile.department;
      $('profileStartDate').value = profile.startDate;
      $('profileStartDate4Off2').value = profile.startDate4Off2 || '';
      document.querySelectorAll('input[name="scheduleType"]').forEach(function (radio) {
        radio.checked = radio.value === profile.scheduleType;
      });
      if (profile.isComplete()) {
        const lines = [
          'รหัส: ' + (profile.employeeId || '-'),
          'ชื่อ: ' + profile.fullName,
          'แผนก: ' + (profile.department || '-'),
          'เริ่มงาน: ' + formatDisplayDate(profile.startDate),
          'ตาราง: ' + (profile.scheduleType === '4off2' ? '4 หยุด 2' : '5 หยุด 2 (3 กะ)'),
        ];
        if (profile.scheduleType === '4off2' && profile.startDate4Off2) {
          lines.splice(3, 0, 'เริ่ม 4 หยุด 2: ' + formatDisplayDate(profile.startDate4Off2));
        }
        $('profileSummaryText').textContent = lines.join('\n');
        $('profileSummary').classList.remove('hidden');
      } else {
        $('profileSummary').classList.add('hidden');
      }
    }

    function saveProfile() {
      const startDate = $('profileStartDate').value;
      if (!startDate) { showToast('กรุณาเลือกวันเริ่มงาน'); return; }
      let scheduleType = '5off2';
      document.querySelectorAll('input[name="scheduleType"]').forEach(function (radio) {
        if (radio.checked) scheduleType = radio.value;
      });
      const startDate4Off2 = $('profileStartDate4Off2').value;
      profile = new EmployeeProfile({
        employeeId: $('profileEmployeeId').value.trim(),
        firstName: $('profileFirstName').value.trim(),
        lastName: $('profileLastName').value.trim(),
        department: $('profileDepartment').value.trim(),
        startDate: startDate,
        startDate4Off2: startDate4Off2,
        scheduleType: scheduleType,
      });
      profileStorage.save(profile);
      state.selectedPeriodIndex = -1;
      showToast('บันทึกโปรไฟล์แล้ว');
      refreshProfile();
    }

    function populateMonthSelect(selectId) {
      const select = $(selectId || 'uploadMonthSelect');
      select.innerHTML = '';
      const now = new Date();
      for (let i = 0; i < 24; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = formatMonthYear(d.getFullYear(), d.getMonth());
        select.appendChild(opt);
      }
      if (!state.selectedUploadMonth) state.selectedUploadMonth = select.value;
      select.value = state.selectedUploadMonth;
    }

    function getMonthRecords(monthKey) {
      return storage.getAllRecords().filter(function (record) {
        return record.date.startsWith(monthKey + '-');
      });
    }

    function getMonthName(monthKey) {
      const parts = monthKey.split('-').map(Number);
      return formatMonthYear(parts[0], parts[1] - 1);
    }

    function buildMonthReportHtml(monthKey) {
      const records = getMonthRecords(monthKey).slice().sort(function (a, b) {
        return a.date.localeCompare(b.date);
      });
      const profileLines = [];
      if (profile.isComplete()) {
        profileLines.push('พนักงาน: ' + (profile.employeeId || '-') + ' | ' + profile.fullName);
        profileLines.push('แผนก: ' + (profile.department || '-'));
        profileLines.push('วันเริ่มงาน: ' + formatDisplayDate(profile.startDate));
        if (profile.scheduleType === '4off2' && profile.startDate4Off2) {
          profileLines.push('วันเริ่ม 4 หยุด 2: ' + formatDisplayDate(profile.startDate4Off2));
        }
        profileLines.push('ตารางงาน: ' + (profile.scheduleType === '4off2' ? '4 หยุด 2' : '5 หยุด 2 (3 กะ)'));
      } else {
        profileLines.push('ยังไม่ตั้งค่าโปรไฟล์');
      }
      let html = '<div class="report-title">ใบบันทึกงาน A&S / Bosch</div>';
      html += '<div class="report-subtitle">' + getMonthName(monthKey) + '</div>';
      html += '<div class="report-summary">';
      profileLines.forEach(function (line) { html += '<p>' + line + '</p>'; });
      html += '<p>วันที่สร้าง: ' + formatDisplayDateToday() + '</p>';
      html += '</div>';
      html += '<table><thead><tr>';
      html += '<th>วันที่</th><th>วัน</th><th>กะ</th><th>เข้า</th><th>ออก</th><th>สาย</th><th>ชั่วโมง</th><th>ค่ากะ</th><th>รายได้</th><th>โน้ต</th>';
      html += '</tr></thead><tbody>';
      if (records.length === 0) {
        html += '<tr><td colspan="10" style="text-align:center; padding: 18px;">ยังไม่มีบันทึกในเดือนนี้</td></tr>';
      } else {
        records.forEach(function (record) {
          const shiftLabel = record.isNonWorkStatus() ? getStatusLabel(record.status) : record.isHolidayOff() ? getShiftLabel(ShiftType.HOLIDAY) : getShiftLabel(record.shiftType);
          const dayOfWeek = parseDateKey(record.date).toLocaleDateString('th-TH', { weekday: 'short' });
          const duration = record.hasCompleteWorkTime() ? calculateDuration(record.checkIn, record.checkOut) : '';
          const shiftAllowance = CompanyWagePolicy.getShiftAllowance(record.shiftType, profile);
          const payText = record.hasCompleteWorkTime() ? formatMoney(calculatePay(record, profile)) : '-';
          html += '<tr>';
          html += '<td>' + formatDisplayDate(record.date) + '</td>';
          html += '<td>' + dayOfWeek + '</td>';
          html += '<td>' + shiftLabel + '</td>';
          html += '<td>' + (record.checkIn || '-') + '</td>';
          html += '<td>' + (record.checkOut || '-') + '</td>';
          html += '<td>' + (record.lateMinutes > 0 ? record.lateMinutes + ' น.' : '-') + '</td>';
          html += '<td>' + (duration || '-') + '</td>';
          html += '<td>' + (shiftAllowance > 0 ? formatMoney(shiftAllowance) : '-') + '</td>';
          html += '<td>' + payText + '</td>';
          html += '<td class="note-cell" style="font-size:0.8rem;">' + (record.note || '-') + '</td>';
          html += '</tr>';
        });
      }
      html += '</tbody></table>';
      return html;
    }

    function exportMonthAsJson() {
      const monthKey = $('uploadMonthSelect').value;
      const payload = {
        monthKey: monthKey,
        generatedAt: new Date().toISOString(),
        profile: profile.toJSON(),
        records: getMonthRecords(monthKey).map(function (r) { return r.toJSON(); }),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'workday-' + monthKey + '.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('ส่งออก JSON สำรองแล้ว');
    }

    function exportMonthAsPdf() {
      const monthKey = $('uploadMonthSelect').value;
      const html = '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>ใบบันทึกงาน ' + getMonthName(monthKey) + '</title><style>' +
        'body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:24px;color:#1a1a2e;background:#fff;}' +
        '.report-title{font-size:1.5rem;font-weight:700;margin-bottom:16px;}' +
        '.report-subtitle{color:#64748b;font-size:1.125rem;margin-bottom:16px;}' +
        '.report-summary p{margin:0 0 8px;}' +
        'table{width:100%;border-collapse:collapse;margin-top:16px;}' +
        'th,td{border:1px solid #cbd5e1;padding:10px 12px;text-align:left;vertical-align:top;font-size:0.9rem;}' +
        'th{background:#f8fafc;}' +
        '.note-cell{white-space:pre-wrap;}' +
        '</style></head><body>' + buildMonthReportHtml(monthKey) + '</body></html>';
      const popup = window.open('', '_blank');
      if (!popup) {
        showToast('ไม่สามารถเปิดหน้าพรีวิวได้');
        return;
      }
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      setTimeout(function () { popup.print(); }, 400);
    }

    function previewLoadPdf() {
      const monthKey = $('previewMonthSelect').value;
      if (!monthKey) {
        showToast('กรุณาเลือกเดือน');
        return;
      }
      const htmlContent = buildMonthReportHtml(monthKey);
      const element = document.createElement('div');
      element.innerHTML = '<style>' +
        'body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:24px;color:#1a1a2e;background:#fff;}' +
        '.report-title{font-size:1.5rem;font-weight:700;margin-bottom:16px;}' +
        '.report-subtitle{color:#64748b;font-size:1.125rem;margin-bottom:16px;}' +
        '.report-summary p{margin:0 0 8px;}' +
        'table{width:100%;border-collapse:collapse;margin-top:16px;}' +
        'th,td{border:1px solid #cbd5e1;padding:10px 12px;text-align:left;vertical-align:top;font-size:0.85rem;}' +
        'th{background:#f8fafc;font-weight:700;}' +
        '.note-cell{white-space:pre-wrap;}' +
        '</style>' + htmlContent;

      const opt = {
        margin: 10,
        filename: 'workday-' + monthKey + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
      };
      html2pdf().set(opt).from(element).save();
      showToast('ดาวน์โหลด PDF แล้ว');
    }

    function previewShowDetails() {
      const monthKey = $('previewMonthSelect').value;
      if (!monthKey) {
        showToast('กรุณาเลือกเดือน');
        return;
      }
      const records = getMonthRecords(monthKey);
      if (records.length === 0) {
        showToast('ไม่มีบันทึกในเดือนนี้');
        return;
      }
      const lines = ['=== ข้อมูลการบันทึกงาน ' + getMonthName(monthKey) + ' ===\n'];
      if (profile.isComplete()) {
        lines.push('พนักงาน: ' + profile.fullName + ' (' + profile.employeeId + ')');
        lines.push('แผนก: ' + profile.department);
      }
      lines.push('');
      records.forEach(function (record) {
        const dayOfWeek = parseDateKey(record.date).toLocaleDateString('th-TH', { weekday: 'short' });
        const shiftLabel = record.isNonWorkStatus() ? getStatusLabel(record.status) : record.isHolidayOff() ? getShiftLabel(ShiftType.HOLIDAY) : getShiftLabel(record.shiftType);
        lines.push(formatDisplayDate(record.date) + ' (' + dayOfWeek + ')');
        lines.push('  กะ: ' + shiftLabel);
        if (record.hasCheckIn()) lines.push('  เข้า: ' + record.checkIn);
        if (record.hasCheckOut()) lines.push('  ออก: ' + record.checkOut);
        if (record.lateMinutes > 0) lines.push('  สาย: ' + record.lateMinutes + ' นาที');
        if (record.hasCompleteWorkTime()) {
          const duration = calculateDuration(record.checkIn, record.checkOut);
          lines.push('  ชั่วโมง: ' + duration);
          lines.push('  รายได้: ' + formatMoney(calculatePay(record, profile)));
        }
        if (record.note) lines.push('  โน้ต: ' + record.note);
        lines.push('');
      });
      const summary = calculatePeriodSummary({startKey: records[0].date, endKey: records[records.length - 1].date}, 0, records, profile);
      lines.push('--- สรุป ---');
      lines.push('วันทำงาน: ' + summary.workDays);
      lines.push('ชั่วโมง: ' + formatHours(summary.hours));
      lines.push('รายได้ทั้งหมด: ' + formatMoney(summary.total));
      showToast('ดูรายละเอียดแล้ว');
    }

    let uploadedPreviewUrl = null;

    function clearUploadPreviewUrl() {
      if (uploadedPreviewUrl) {
        URL.revokeObjectURL(uploadedPreviewUrl);
        uploadedPreviewUrl = null;
      }
    }

    function createPreviewUrl(data) {
      if (!data) return null;
      if (typeof data === 'string' && data.startsWith('data:')) {
        const parts = data.split(',');
        const mime = parts[0].match(/data:(.*?);/);
        const content = atob(parts[1]);
        const bytes = new Uint8Array(content.length);
        for (let i = 0; i < content.length; i++) bytes[i] = content.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime ? mime[1] : 'application/octet-stream' });
        return URL.createObjectURL(blob);
      }
      if (data instanceof Blob || data instanceof File) {
        return URL.createObjectURL(data);
      }
      return null;
    }

    function toDataUrl(file) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject(reader.error); };
        reader.readAsDataURL(file);
      });
    }

    async function uploadTimesheet() {
      const input = $('timesheetFile');
      const file = input.files && input.files[0];
      if (!file) {
        showToast('กรุณาเลือกไฟล์ก่อน');
        return;
      }
      const monthKey = $('uploadMonthSelect').value;
      if (!monthKey) {
        showToast('กรุณาเลือกเดือน');
        return;
      }
      try {
        const dataUrl = await toDataUrl(file);
        await TimesheetDB.put({
          monthKey: monthKey,
          filename: file.name,
          fileType: file.type || 'application/octet-stream',
          data: dataUrl,
          uploadedAt: new Date().toISOString(),
        });
        input.value = '';
        showToast('อัปโหลดไฟล์แล้ว');
        refreshDocuments();
      } catch (e) {
        showToast('ไม่สามารถอัปโหลดไฟล์ได้: ' + (e && e.message ? e.message : 'unknown'));
      }
    }

    async function deleteTimesheet() {
      const monthKey = $('uploadMonthSelect').value;
      if (!monthKey) {
        showToast('กรุณาเลือกเดือน');
        return;
      }
      const current = await TimesheetDB.get(monthKey);
      if (!current) {
        showToast('ยังไม่มีไฟล์ให้ลบ');
        return;
      }
      try {
        await TimesheetDB.delete(monthKey);
        showToast('ลบไฟล์แล้ว');
        refreshDocuments();
      } catch (e) {
        showToast('ไม่สามารถลบไฟล์ได้');
      }
    }

    function showUploadedFile(item) {
      const preview = $('uploadPreview');
      const previewCard = $('uploadPreviewCard');
      const fileNameEl = $('uploadFileName');
      if (!item) {
        clearUploadPreviewUrl();
        preview.innerHTML = '';
        fileNameEl.textContent = '';
        previewCard.classList.add('hidden');
        return;
      }

      preview.innerHTML = '';
      clearUploadPreviewUrl();
      const url = createPreviewUrl(item.data);
      if (!url) {
        const info = document.createElement('p');
        info.textContent = 'ไฟล์นี้ไม่สามารถแสดงตัวอย่างได้';
        preview.appendChild(info);
        previewCard.classList.remove('hidden');
        return;
      }
      uploadedPreviewUrl = url;
      fileNameEl.textContent = item.filename || 'ไม่ระบุชื่อไฟล์';

      const lowerName = (item.filename || '').toLowerCase();
      const isImage = (item.fileType && item.fileType.startsWith('image/')) || /\.(jpe?g|png|gif|bmp|webp)$/i.test(lowerName);
      const isPdf = item.fileType === 'application/pdf' || /\.pdf$/i.test(lowerName);

      if (isImage) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = item.filename || 'Preview';
        img.className = 'upload-preview-image';
        preview.appendChild(img);
      } else if (isPdf) {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.className = 'upload-preview-pdf';
        iframe.title = item.filename || 'PDF Preview';
        preview.appendChild(iframe);
      } else {
        const info = document.createElement('p');
        info.textContent = 'ไฟล์ชนิดนี้ไม่สามารถแสดงตัวอย่างได้';
        preview.appendChild(info);
      }

      previewCard.classList.remove('hidden');
    }

    function showUploadedFilePage(item) {
      const preview = $('uploadPagePreview');
      const previewCard = $('uploadPagePreviewCard');
      const fileNameEl = $('uploadPageFileName');
      if (!item) {
        clearUploadPreviewUrl();
        preview.innerHTML = '';
        fileNameEl.textContent = '';
        previewCard.classList.add('hidden');
        return;
      }

      preview.innerHTML = '';
      clearUploadPreviewUrl();
      const url = createPreviewUrl(item.data);
      if (!url) {
        const info = document.createElement('p');
        info.textContent = 'ไฟล์นี้ไม่สามารถแสดงตัวอย่างได้';
        preview.appendChild(info);
        previewCard.classList.remove('hidden');
        return;
      }
      uploadedPreviewUrl = url;
      fileNameEl.textContent = item.filename || 'ไม่ระบุชื่อไฟล์';

      const lowerName = (item.filename || '').toLowerCase();
      const isImage = (item.fileType && item.fileType.startsWith('image/')) || /\.(jpe?g|png|gif|bmp|webp)$/i.test(lowerName);
      const isPdf = item.fileType === 'application/pdf' || /\.pdf$/i.test(lowerName);

      if (isImage) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = item.filename || 'Preview';
        img.className = 'upload-preview-image';
        preview.appendChild(img);
      } else if (isPdf) {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.className = 'upload-preview-pdf';
        iframe.title = item.filename || 'PDF Preview';
        preview.appendChild(iframe);
      } else {
        const info = document.createElement('p');
        info.textContent = 'ไฟล์ชนิดนี้ไม่สามารถแสดงตัวอย่างได้';
        preview.appendChild(info);
      }

      previewCard.classList.remove('hidden');
    }

    async function uploadTimesheetPage() {
      const input = $('uploadPageFile');
      const file = input.files && input.files[0];
      if (!file) {
        showToast('กรุณาเลือกไฟล์ก่อน');
        return;
      }
      const monthKey = $('uploadPageMonthSelect').value;
      if (!monthKey) {
        showToast('กรุณาเลือกเดือน');
        return;
      }
      try {
        const dataUrl = await toDataUrl(file);
        await TimesheetDB.put({
          monthKey: monthKey,
          filename: file.name,
          fileType: file.type || 'application/octet-stream',
          data: dataUrl,
          uploadedAt: new Date().toISOString(),
        });
        input.value = '';
        showToast('อัปโหลดไฟล์แล้ว');
        refreshDocuments();
        refreshDocumentsUpload();
      } catch (e) {
        showToast('ไม่สามารถอัปโหลดไฟล์ได้: ' + (e && e.message ? e.message : 'unknown'));
      }
    }

    async function deleteTimesheetPage() {
      const monthKey = $('uploadPageMonthSelect').value;
      if (!monthKey) {
        showToast('กรุณาเลือกเดือน');
        return;
      }
      try {
        const current = await TimesheetDB.get(monthKey);
        if (!current) {
          showToast('ยังไม่มีไฟล์ให้ลบ');
          return;
        }
        await TimesheetDB.delete(monthKey);
        showToast('ลบไฟล์แล้ว');
        refreshDocuments();
        refreshDocumentsUpload();
      } catch (e) {
        showToast('ไม่สามารถลบไฟล์ได้');
      }
    }

    function promptJsonImport() {
      const fileInput = $('jsonImportFile');
      fileInput.value = '';
      fileInput.click();
    }

    function handleJsonImport(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const parsed = JSON.parse(reader.result);
          let count = 0;
          if (Array.isArray(parsed)) {
            count = storage.importRecords(JSON.stringify(parsed));
          } else if (parsed.records) {
            count = storage.importRecords(JSON.stringify(parsed.records));
            if (parsed.profile) {
              profile = EmployeeProfile.fromJSON(parsed.profile);
              profileStorage.save(profile);
            }
          } else {
            throw new Error('invalid');
          }
          showToast('นำเข้า ' + count + ' รายการแล้ว');
          if (state.view === 'home') refreshHome();
          if (state.view === 'calendar') refreshCalendar();
          if (state.view === 'documents') refreshDocuments();
        } catch (e) {
          showToast('ไฟล์ JSON ไม่ถูกต้อง');
        }
      };
      reader.readAsText(file);
    }

    async function refreshDocuments() {
      populateMonthSelect('uploadMonthSelect');
      populateMonthSelect('previewMonthSelect');
      const monthKey = $('uploadMonthSelect').value;
      state.selectedUploadMonth = monthKey;

      const list = $('documentsList');
      list.innerHTML = '';
      try {
        const all = await TimesheetDB.getAll();
        all.sort(function (a, b) { return b.monthKey.localeCompare(a.monthKey); });
        $('emptyDocuments').classList.toggle('hidden', all.length > 0);
        all.forEach(function (item) {
          const li = document.createElement('li');
          li.className = 'history-item';
          const label = item.monthKey.split('-');
          const monthLabel = formatMonthYear(parseInt(label[0], 10), parseInt(label[1], 10) - 1);
          li.innerHTML = '<p class="date">' + monthLabel + '</p><p class="muted">' + item.filename + '</p>';
          li.addEventListener('click', function () {
            $('uploadMonthSelect').value = item.monthKey;
            state.selectedUploadMonth = item.monthKey;
            showUploadedFile(item);
          });
          list.appendChild(li);
        });
        const current = await TimesheetDB.get(monthKey);
        if (current) showUploadedFile(current);
        else {
          clearUploadPreviewUrl();
          $('uploadPreviewCard').classList.add('hidden');
        }
      } catch (e) {
        showToast('ไม่สามารถโหลดเอกสารได้');
      }

      const preview = $('documentsPreview');
      const records = getMonthRecords(monthKey);
      if (records.length === 0) {
        $('documentsPreviewCard').classList.add('hidden');
      } else {
        const lines = records.map(function (record) {
          const shiftLabel = record.isNonWorkStatus() ? getStatusLabel(record.status) : record.isHolidayOff() ? getShiftLabel(ShiftType.HOLIDAY) : getShiftLabel(record.shiftType);
          const duration = record.hasCompleteWorkTime() ? calculateDuration(record.checkIn, record.checkOut) : '-';
          const payText = record.hasCompleteWorkTime() ? formatMoney(calculatePay(record, profile)) : '-';
          return formatDisplayDate(record.date) + ' | ' + shiftLabel + ' | ' + (record.checkIn || '-') + ' - ' + (record.checkOut || '-') + ' | ' + duration + ' | ' + payText + '\n' + (record.note || '');
        });
        preview.textContent = 'เดือน: ' + getMonthName(monthKey) + '\n\n' + lines.join('\n\n');
        $('documentsPreviewCard').classList.remove('hidden');
      }
    }

    async function refreshDocumentsUpload() {
      populateMonthSelect('uploadPageMonthSelect');
      const monthKey = $('uploadPageMonthSelect').value;
      state.selectedUploadMonth = monthKey;

      const list = $('uploadPageDocumentsList');
      list.innerHTML = '';
      try {
        const all = await TimesheetDB.getAll();
        all.sort(function (a, b) { return b.monthKey.localeCompare(a.monthKey); });
        $('emptyUploadPageDocuments').classList.toggle('hidden', all.length > 0);
        all.forEach(function (item) {
          const li = document.createElement('li');
          li.className = 'history-item';
          const label = item.monthKey.split('-');
          const monthLabel = formatMonthYear(parseInt(label[0], 10), parseInt(label[1], 10) - 1);
          li.innerHTML = '<p class="date">' + monthLabel + '</p><p class="muted">' + item.filename + '</p>';
          li.addEventListener('click', function () {
            $('uploadPageMonthSelect').value = item.monthKey;
            state.selectedUploadMonth = item.monthKey;
            showUploadedFilePage(item);
          });
          list.appendChild(li);
        });
        const current = await TimesheetDB.get(monthKey);
        if (current) showUploadedFilePage(current);
        else showUploadedFilePage(null);
      } catch (e) {
        showToast('ไม่สามารถโหลดเอกสารได้');
      }
    }

    function exportData() {
      const payload = JSON.stringify({
        records: storage.getAllRecords().map(function (r) { return r.toJSON(); }),
        profile: profile.toJSON(),
      }, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(payload).then(function () {
          showToast('คัดลอกข้อมูลแล้ว');
        }).catch(function () {
          $('importExportArea').value = payload;
          $('importExportArea').classList.remove('hidden');
        });
      } else {
        $('importExportArea').value = payload;
        $('importExportArea').classList.remove('hidden');
      }
    }

    function buildReportHtml() {
      const records = storage.getAllRecords().slice().sort(function (a, b) {
        return a.date.localeCompare(b.date);
      });
      const profileLines = [];
      if (profile.isComplete()) {
        profileLines.push('พนักงาน: ' + (profile.employeeId || '-') + ' | ' + profile.fullName);
        profileLines.push('แผนก: ' + (profile.department || '-'));
        profileLines.push('วันเริ่มงาน: ' + formatDisplayDate(profile.startDate));
        if (profile.scheduleType === '4off2' && profile.startDate4Off2) {
          profileLines.push('วันเริ่ม 4 หยุด 2: ' + formatDisplayDate(profile.startDate4Off2));
        }
        profileLines.push('ตารางงาน: ' + (profile.scheduleType === '4off2' ? '4 หยุด 2' : '5 หยุด 2 (3 กะ)'));
      } else {
        profileLines.push('ยังไม่ตั้งค่าโปรไฟล์');
      }
      let html = '<div class="report-title">ใบบันทึกงาน A&S / Bosch</div>';
      html += '<div class="report-subtitle">รายงานบันทึกทั้งหมดของระบบ</div>';
      html += '<div class="report-summary">';
      profileLines.forEach(function (line) { html += '<p>' + line + '</p>'; });
      html += '<p>วันที่สร้าง: ' + formatDisplayDateToday() + '</p>';
      html += '</div>';
      html += '<table><thead><tr>';
      html += '<th>วันที่</th><th>สถานะ/กะ</th><th>เข้า</th><th>ออก</th><th>สาย</th><th>ชั่วโมง</th><th>รายได้</th><th>โน้ต</th>';
      html += '</tr></thead><tbody>';
      if (records.length === 0) {
        html += '<tr><td colspan="8" style="text-align:center; padding: 18px;">ยังไม่มีบันทึก</td></tr>';
      } else {
        records.forEach(function (record) {
          const shiftLabel = record.isNonWorkStatus() ? getStatusLabel(record.status) : record.isHolidayOff() ? getShiftLabel(ShiftType.HOLIDAY) : getShiftLabel(record.shiftType);
          const duration = record.hasCompleteWorkTime() ? calculateDuration(record.checkIn, record.checkOut) : '';
          const payText = record.hasCompleteWorkTime() ? formatMoney(calculatePay(record, profile)) : '-';
          html += '<tr>';
          html += '<td>' + formatDisplayDate(record.date) + '</td>';
          html += '<td>' + shiftLabel + '</td>';
          html += '<td>' + (record.checkIn || '-') + '</td>';
          html += '<td>' + (record.checkOut || '-') + '</td>';
          html += '<td>' + (record.lateMinutes > 0 ? record.lateMinutes + ' นาที' : '-') + '</td>';
          html += '<td>' + (duration || '-') + '</td>';
          html += '<td>' + payText + '</td>';
          html += '<td class="note-cell">' + (record.note || '-') + '</td>';
          html += '</tr>';
        });
      }
      html += '</tbody></table>';
      return html;
    }

    function downloadReportAsImage() {
      const container = $('exportReportContainer');
      container.innerHTML = buildReportHtml();
      container.classList.remove('hidden');
      const width = 1200;
      container.style.width = width + 'px';
      const height = container.scrollHeight;
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">';
      const foreign = '<foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:' + width + 'px; font-family: Arial, Helvetica, sans-serif;">' + container.innerHTML + '</div></foreignObject>';
      const svgData = svg + foreign + '</svg>';
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (fileBlob) {
          if (!fileBlob) { showToast('ไม่สามารถสร้างรูปได้'); return; }
          const link = document.createElement('a');
          link.href = URL.createObjectURL(fileBlob);
          link.download = 'workday-report-' + todayDateKey() + '.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast('ดาวน์โหลดรูปแล้ว');
        }, 'image/png');
      };
      img.onerror = function () {
        showToast('ไม่สามารถสร้างรูปได้');
      };
      img.src = url;
    }

    function printReport() {
      const html = '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>ใบบันทึกงาน</title><style>' +
        'body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:24px;color:#1a1a2e;background:#fff;}' +
        '.report-title{font-size:1.5rem;font-weight:700;margin-bottom:16px;}' +
        '.report-subtitle{color:#64748b;margin-bottom:24px;}' +
        '.report-summary p{margin:0 0 8px;}' +
        'table{width:100%;border-collapse:collapse;margin-top:16px;}' +
        'th,td{border:1px solid #cbd5e1;padding:10px 12px;text-align:left;vertical-align:top;font-size:0.9rem;}' +
        'th{background:#f8fafc;}' +
        '.note-cell{white-space:pre-wrap;}' +
        '</style></head><body>' + buildReportHtml() + '</body></html>';
      const popup = window.open('', '_blank');
      if (!popup) {
        showToast('ไม่สามารถเปิดหน้าพรีวิวได้');
        return;
      }
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      setTimeout(function () { popup.print(); }, 400);
    }

    function toggleImport() {
      const area = $('importExportArea');
      const btn = $('btnConfirmImport');
      const hidden = area.classList.contains('hidden');
      area.classList.toggle('hidden', !hidden);
      btn.classList.toggle('hidden', !hidden);
      if (hidden) area.value = '';
    }

    function confirmImport() {
      try {
        const parsed = JSON.parse($('importExportArea').value);
        let count = 0;
        if (Array.isArray(parsed)) {
          count = storage.importRecords($('importExportArea').value);
        } else if (parsed.records) {
          count = storage.importRecords(JSON.stringify(parsed.records));
          if (parsed.profile) {
            profile = EmployeeProfile.fromJSON(parsed.profile);
            profileStorage.save(profile);
          }
        } else throw new Error('invalid');
        $('importExportArea').classList.add('hidden');
        $('btnConfirmImport').classList.add('hidden');
        showToast('นำเข้า ' + count + ' รายการแล้ว');
        if (state.view === 'home') refreshHome();
        if (state.view === 'calendar') refreshCalendar();
      } catch (e) {
        showToast('รูปแบบ JSON ไม่ถูกต้อง');
      }
    }

    setupShiftSelect();
    $('btnCheckIn').addEventListener('click', handleCheckIn);
    $('btnCheckOut').addEventListener('click', handleCheckOut);
    $('btnSave').addEventListener('click', saveDayDetail);
    $('btnClear').addEventListener('click', clearDayDetail);
    $('btnSaveProfile').addEventListener('click', saveProfile);
    $('btnUploadTimesheet').addEventListener('click', uploadTimesheet);
    $('btnDeleteTimesheet').addEventListener('click', deleteTimesheet);
    $('btnOpenUploadPage').addEventListener('click', function () { navigate('documentsUpload'); });
    $('btnUploadPageUpload').addEventListener('click', uploadTimesheetPage);
    $('btnUploadPageDelete').addEventListener('click', deleteTimesheetPage);
    $('btnBackToDocuments').addEventListener('click', function () { navigate('documents'); });
    $('btnPreviewLoadPdf').addEventListener('click', previewLoadPdf);
    $('btnPreviewShowDetails').addEventListener('click', previewShowDetails);
    $('previewMonthSelect').addEventListener('change', function () {
      state.selectedUploadMonth = $('previewMonthSelect').value;
    });
    $('btnExportMonthPdf').addEventListener('click', exportMonthAsPdf);
    $('btnExportMonthJson').addEventListener('click', exportMonthAsJson);
    $('btnImportMonthJson').addEventListener('click', promptJsonImport);
    $('jsonImportFile').addEventListener('change', handleJsonImport);
    $('btnBack').addEventListener('click', function () {
      if (state.view === 'documentsUpload') navigate('documents');
      else navigate('calendar');
    });
    $('btnPrevMonth').addEventListener('click', function () {
      const d = new Date(state.calYear, state.calMonth - 1, 1);
      state.calYear = d.getFullYear();
      state.calMonth = d.getMonth();
      refreshCalendar();
    });
    $('btnNextMonth').addEventListener('click', function () {
      const d = new Date(state.calYear, state.calMonth + 1, 1);
      state.calYear = d.getFullYear();
      state.calMonth = d.getMonth();
      refreshCalendar();
    });
    $('selectedDayCard').addEventListener('click', function () {
      navigate('dayDetail', state.selectedDateKey);
    });
    $('periodSelect').addEventListener('change', function () {
      state.selectedPeriodIndex = parseInt($('periodSelect').value, 10);
      refreshHome();
    });
    $('statusSelect').addEventListener('change', function () {
      updateDayDetailFieldsVisibility();
      updatePreview();
    });
    $('editCheckIn').addEventListener('input', updatePreview);
    $('editCheckOut').addEventListener('input', updatePreview);
    $('editLate').addEventListener('input', updatePreview);
    $('shiftSelect').addEventListener('change', updatePreview);
    $('uploadMonthSelect').addEventListener('change', refreshDocuments);
    $('uploadPageMonthSelect').addEventListener('change', refreshDocumentsUpload);
    $('btnExport').addEventListener('click', exportData);
    $('btnImport').addEventListener('click', toggleImport);
    $('btnConfirmImport').addEventListener('click', confirmImport);
    document.querySelectorAll('.nav-item').forEach(function (btn) {
      btn.addEventListener('click', function () { navigate(btn.dataset.view); });
    });

    navigate('home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();