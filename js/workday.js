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

  const SHIFT_LABELS = {
    auto: 'ตรวจจับอัตโนมัติ', morning: 'กะเช้า (08:00-17:30)', morning_ot: 'OT กะเช้า (08:00-20:00)',
    early: 'กะเข้า (06:00-14:00)', afternoon: 'กะบ่าย (14:00-22:00)', afternoon_ot: 'OT กะบ่าย (14:00-24:00)',
    night: 'กะดึก (20:00-05:30)', night_ot: 'OT กะดึก (20:00-08:00)', young: 'กะเด็ก (22:00-06:00)',
    holiday: 'วันหยุด (ไม่ทำงาน)', holiday_morning_1730: 'วันหยุด กะเช้า (เลิก 17:30)',
    holiday_morning_2000: 'OT วันหยุด กะเช้า (เลิก 20:00)', holiday_afternoon_2200: 'วันหยุด กะบ่าย (เลิก 22:00)',
    holiday_afternoon_ot: 'OT วันหยุด กะบ่าย (เลิก 24:00)', holiday_night_0530: 'วันหยุด กะดึก (เลิก 05:30)',
    holiday_night_0800: 'OT วันหยุด กะดึก (เลิก 08:00)',
  };

  const ALL_SHIFT_VALUES = [
    ShiftType.AUTO, ShiftType.MORNING, ShiftType.MORNING_OT, ShiftType.EARLY,
    ShiftType.AFTERNOON, ShiftType.AFTERNOON_OT, ShiftType.NIGHT, ShiftType.NIGHT_OT,
    ShiftType.YOUNG, ShiftType.HOLIDAY, ShiftType.HOLIDAY_MORNING_1730,
    ShiftType.HOLIDAY_MORNING_2000, ShiftType.HOLIDAY_AFTERNOON_2200,
    ShiftType.HOLIDAY_AFTERNOON_OT, ShiftType.HOLIDAY_NIGHT_0530, ShiftType.HOLIDAY_NIGHT_0800,
  ];

  function getShiftLabel(shiftType) {
    return SHIFT_LABELS[shiftType] || SHIFT_LABELS.auto;
  }

  class WorkDayRecord {
    constructor(date, checkIn, checkOut, note, shiftType) {
      this.date = date;
      this.checkIn = checkIn || '';
      this.checkOut = checkOut || '';
      this.note = note || '';
      this.shiftType = shiftType && shiftType.length > 0 ? shiftType : ShiftType.AUTO;
    }
    hasCheckIn() { return this.checkIn.length > 0; }
    hasCheckOut() { return this.checkOut.length > 0; }
    hasNote() { return this.note.length > 0; }
    hasContent() {
      return this.shiftType === ShiftType.HOLIDAY || this.hasCheckIn() || this.hasCheckOut() || this.hasNote();
    }
    isHolidayOff() { return this.shiftType === ShiftType.HOLIDAY; }
    hasCompleteWorkTime() {
      if (this.shiftType === ShiftType.HOLIDAY) return true;
      return this.hasCheckIn() && this.hasCheckOut();
    }
    isCountableWorkDay() {
      if (this.shiftType === ShiftType.HOLIDAY) return false;
      return this.hasCompleteWorkTime();
    }
    toJSON() {
      return { date: this.date, checkIn: this.checkIn, checkOut: this.checkOut, note: this.note, shiftType: this.shiftType };
    }
    static fromJSON(obj) {
      return new WorkDayRecord(obj.date, obj.checkIn || '', obj.checkOut || '', obj.note || '', obj.shiftType || ShiftType.AUTO);
    }
  }

  function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function todayDateKey() { return formatDateKey(new Date()); }

  function currentTime() {
    const now = new Date();
    return formatTime(now.getHours(), now.getMinutes());
  }

  function formatTime(hour, minute) {
    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  }

  function formatDisplayDate(dateKey) {
    const p = dateKey.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
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

  function formatDurationLabel(duration) {
    return duration ? 'ชั่วโมงทำงาน: ' + duration : '';
  }

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

  function buildMonthGrid(year, month, recordedDates, selectedDateKey, todayKey) {
    const startWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ empty: true });
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKeyFromParts(year, month, day);
      cells.push({
        empty: false, dateKey: key, day,
        isToday: key === todayKey, isSelected: key === selectedDateKey, hasRecord: recordedDates.has(key),
      });
    }
    return cells;
  }

  function detectNightEnd(checkOut, workedMinutes, young) {
    if (young) return ShiftType.YOUNG;
    if (!checkOut) return ShiftType.NIGHT;
    if (workedMinutes >= 11 * 60 || parseHour(checkOut) >= 7) return ShiftType.NIGHT_OT;
    return ShiftType.NIGHT;
  }

  function isNightAllowance(shift) {
    return shift === ShiftType.NIGHT || shift === ShiftType.NIGHT_OT
      || shift === ShiftType.HOLIDAY_NIGHT_0530 || shift === ShiftType.HOLIDAY_NIGHT_0800
      || shift === ShiftType.YOUNG;
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
    DAILY_WAGE: 400, SPECIAL_ALLOWANCE: 12.5,
    NIGHT_SHIFT_ALLOWANCE: 165, NIGHT_MEAL_ALLOWANCE: 65, NIGHT_MILK_ALLOWANCE: 65,
    HOURLY_RATE: 50, REGULAR_OT_MULTIPLIER: 1.5, HOLIDAY_WORK_MULTIPLIER: 2.0, HOLIDAY_OT_MULTIPLIER: 3.0,

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

    calculateDailyPay(record) {
      const shift = this.resolveShift(record);
      if (shift === ShiftType.HOLIDAY || !record.hasCompleteWorkTime()) return 0;
      let base = this.DAILY_WAGE + this.SPECIAL_ALLOWANCE;
      if (ShiftType.isHolidayWork(shift)) base *= this.HOLIDAY_WORK_MULTIPLIER;
      let total = base;
      if (isNightAllowance(shift)) total += this.NIGHT_SHIFT_ALLOWANCE + this.NIGHT_MEAL_ALLOWANCE + this.NIGHT_MILK_ALLOWANCE;
      total += this.calculateOtPay(record, shift);
      return total;
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

    isNightShift(shift) { return isNightAllowance(shift); },
  };

  function calculatePay(record) { return CompanyWagePolicy.calculateDailyPay(record); }

  function sumPay(records) {
    let total = 0;
    for (let i = 0; i < records.length; i++) total += calculatePay(records[i]);
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

  function formatPayLine(record) {
    if (record.isHolidayOff()) return 'วันหยุด';
    if (!record.isCountableWorkDay()) return '';
    return calculateDuration(record.checkIn, record.checkOut) + ' = ' + formatMoney(calculatePay(record));
  }

  function formatPayBreakdown(record) {
    if (record.isHolidayOff()) return getShiftLabel(ShiftType.HOLIDAY);
    if (!record.hasCompleteWorkTime()) return '';
    const shift = CompanyWagePolicy.resolveShift(record);
    const pay = calculatePay(record);
    const otPay = CompanyWagePolicy.calculateOtPay(record, shift);
    const lines = ['กะงาน: ' + getShiftLabel(shift)];
    if (ShiftType.isHolidayWork(shift)) lines.push('ค่าจ้างวันหยุด: x' + CompanyWagePolicy.HOLIDAY_WORK_MULTIPLIER);
    lines.push('ค่าจ้างรายวัน: ' + formatMoney(ShiftType.isHolidayWork(shift) ? CompanyWagePolicy.DAILY_WAGE * 2 : CompanyWagePolicy.DAILY_WAGE));
    lines.push('เงินพิเศษ: ' + formatMoney(ShiftType.isHolidayWork(shift) ? CompanyWagePolicy.SPECIAL_ALLOWANCE * 2 : CompanyWagePolicy.SPECIAL_ALLOWANCE));
    if (CompanyWagePolicy.isNightShift(shift)) {
      lines.push('ค่ากะดึก: ' + formatMoney(CompanyWagePolicy.NIGHT_SHIFT_ALLOWANCE));
      lines.push('ค่าข้าวกะดึก: ' + formatMoney(CompanyWagePolicy.NIGHT_MEAL_ALLOWANCE));
      lines.push('ค่านมกะดึก: ' + formatMoney(CompanyWagePolicy.NIGHT_MILK_ALLOWANCE));
    }
    if (otPay > 0) lines.push('ค่า OT: ' + formatMoney(otPay));
    lines.push('รายได้วันนี้: ' + formatMoney(pay));
    return lines.join('\n');
  }

  const STORAGE_KEY = 'work_day_records';

  class WorkDayStorage {
    getAllRecords() {
      try {
        const array = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const records = array.map(function (obj) { return WorkDayRecord.fromJSON(obj); });
        records.sort(function (a, b) { return b.date.localeCompare(a.date); });
        return records;
      } catch (e) {
        return [];
      }
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
    getHistoryExcludingToday(today) {
      return this.getAllRecords().filter(function (r) { return r.date !== today; });
    }
    getTotalEarnings() { return sumPay(this.getAllRecords()); }
    getTotalWorkHours() { return sumWorkHours(this.getAllRecords()); }
    getTotalWorkDays() { return countWorkDays(this.getAllRecords()); }
  }

  function initApp() {
    const storage = new WorkDayStorage();
    const state = {
      view: 'home', detailDateKey: null,
      calYear: new Date().getFullYear(), calMonth: new Date().getMonth(),
      selectedDateKey: todayDateKey(),
    };

    function $(id) { return document.getElementById(id); }

    const views = {
      home: $('viewHome'), calendar: $('viewCalendar'),
      dayDetail: $('viewDayDetail'), info: $('viewInfo'),
    };

    const titles = { home: 'หน้าหลัก', calendar: 'ปฏิทิน', dayDetail: 'บันทึกรายละเอียดวัน', info: 'ข้อมูล' };

    function showToast(msg) {
      const el = $('toast');
      el.textContent = msg;
      el.classList.remove('hidden');
      clearTimeout(showToast._timer);
      showToast._timer = setTimeout(function () { el.classList.add('hidden'); }, 2500);
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
      const isDetail = view === 'dayDetail';
      $('btnBack').classList.toggle('hidden', !isDetail);
      $('pageTitle').textContent = isDetail && state.detailDateKey
        ? formatDisplayDate(state.detailDateKey) : (titles[view] || 'บันทึกวันทำงาน');
      document.querySelector('.bottom-nav').classList.toggle('hidden', isDetail);
      if (view === 'home') refreshHome();
      if (view === 'calendar') refreshCalendar();
      if (view === 'dayDetail') refreshDayDetail();
    }

    function refreshHome() {
      const todayKey = todayDateKey();
      $('todayDate').textContent = formatDisplayDateToday();
      const record = storage.getRecordForDate(todayKey);
      $('todayCheckIn').textContent = record && record.hasCheckIn() ? record.checkIn : 'ยังไม่บันทึก';
      $('todayCheckOut').textContent = record && record.hasCheckOut() ? record.checkOut : 'ยังไม่บันทึก';
      if (record && record.isCountableWorkDay()) {
        $('todayDuration').textContent = formatDurationLabel(calculateDuration(record.checkIn, record.checkOut));
        $('todayDuration').classList.remove('hidden');
        $('todayWage').textContent = 'รายได้วันนี้: ' + formatMoney(calculatePay(record));
        $('todayWage').classList.remove('hidden');
      } else {
        $('todayDuration').classList.add('hidden');
        $('todayWage').classList.add('hidden');
      }
      $('btnCheckIn').disabled = !!(record && record.hasCheckIn());
      $('btnCheckOut').disabled = !(record && record.hasCheckIn()) || !!(record && record.hasCheckOut());
      $('totalDays').textContent = storage.getTotalWorkDays() + ' วัน';
      $('totalHours').textContent = formatHours(storage.getTotalWorkHours());
      $('totalWage').textContent = formatMoney(storage.getTotalEarnings());
      const history = storage.getHistoryExcludingToday(todayKey);
      $('emptyHistory').classList.toggle('hidden', history.length > 0);
      const list = $('historyList');
      list.innerHTML = '';
      history.forEach(function (r) {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.addEventListener('click', function () { navigate('dayDetail', r.date); });
        const dateEl = document.createElement('p');
        dateEl.className = 'date';
        dateEl.textContent = formatDisplayDate(r.date);
        const detailEl = document.createElement('p');
        detailEl.className = 'muted';
        if (r.isHolidayOff()) detailEl.textContent = 'วันหยุด';
        else if (r.isCountableWorkDay()) detailEl.textContent = r.checkIn + ' - ' + r.checkOut;
        else if (r.hasCheckIn()) detailEl.textContent = 'เข้างาน ' + r.checkIn;
        else detailEl.textContent = r.note || 'มีบันทึก';
        li.appendChild(dateEl);
        li.appendChild(detailEl);
        if (r.isCountableWorkDay()) {
          const payEl = document.createElement('p');
          payEl.className = 'pay';
          payEl.textContent = formatPayLine(r);
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
      const grid = $('calendarGrid');
      grid.innerHTML = '';
      buildMonthGrid(state.calYear, state.calMonth, getRecordedDates(), state.selectedDateKey, todayDateKey())
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
          btn.textContent = cell.day;
          btn.addEventListener('click', function () {
            state.selectedDateKey = cell.dateKey;
            navigate('dayDetail', cell.dateKey);
          });
          grid.appendChild(btn);
        });
      updateSelectedDayDetail();
    }

    function updateSelectedDayDetail() {
      const key = state.selectedDateKey;
      $('selectedDate').textContent = formatDisplayDate(key);
      const record = storage.getRecordForDate(key);
      if (!record || !record.hasContent()) {
        $('selectedDetail').textContent = 'ไม่มีการบันทึกในวันนี้';
        return;
      }
      if (record.isHolidayOff()) {
        $('selectedDetail').textContent = getShiftLabel(ShiftType.HOLIDAY);
        return;
      }
      const lines = [];
      if (record.hasCheckIn()) lines.push('เข้างาน ' + record.checkIn);
      if (record.hasCheckOut()) lines.push('ออกงาน ' + record.checkOut);
      if (record.isCountableWorkDay()) {
        lines.push(formatDurationLabel(calculateDuration(record.checkIn, record.checkOut)));
        lines.push('รายได้วันนี้: ' + formatMoney(calculatePay(record)));
        lines.push('กะงาน: ' + getShiftLabel(CompanyWagePolicy.resolveShift(record)));
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

    function refreshDayDetail() {
      const dateKey = state.detailDateKey;
      if (!dateKey) return;
      $('dayDetailDate').textContent = formatDisplayDate(dateKey);
      const record = storage.getRecordForDate(dateKey);
      $('editCheckIn').value = toTimeInputValue(record ? record.checkIn : '');
      $('editCheckOut').value = toTimeInputValue(record ? record.checkOut : '');
      $('editNote').value = record ? record.note : '';
      $('shiftSelect').value = record ? record.shiftType : ShiftType.AUTO;
      updateTimeFieldsVisibility();
      updatePreview();
      updateSavedPreview();
    }

    function updateTimeFieldsVisibility() {
      $('timeFields').classList.toggle('hidden', $('shiftSelect').value === ShiftType.HOLIDAY);
    }

    function updatePreview() {
      const dateKey = state.detailDateKey;
      const shift = $('shiftSelect').value;
      if (shift === ShiftType.HOLIDAY) {
        $('previewDuration').classList.add('hidden');
        $('previewWage').textContent = getShiftLabel(ShiftType.HOLIDAY);
        $('previewWage').classList.remove('hidden');
        return;
      }
      const checkIn = $('editCheckIn').value || '';
      const checkOut = $('editCheckOut').value || '';
      const preview = new WorkDayRecord(dateKey, checkIn, checkOut, '', shift);
      const duration = checkIn && checkOut ? calculateDuration(checkIn, checkOut) : '';
      if (duration) {
        $('previewDuration').textContent = formatDurationLabel(duration);
        $('previewDuration').classList.remove('hidden');
        $('previewWage').textContent = formatPayBreakdown(preview);
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
      let preview = '';
      if (record.isHolidayOff()) {
        preview = formatPayBreakdown(record);
      } else {
        const parts = [];
        if (record.hasCheckIn()) parts.push('เข้างาน ' + record.checkIn);
        if (record.hasCheckOut()) parts.push('ออกงาน ' + record.checkOut);
        if (record.isCountableWorkDay()) parts.push(formatPayBreakdown(record));
        else if (record.hasNote()) parts.push('บันทึก/โน้ต: ' + record.note);
        preview = parts.join('\n');
      }
      $('savedPreview').textContent = preview.trim();
      $('savedPreviewCard').classList.remove('hidden');
    }

    function handleCheckIn() {
      const todayKey = todayDateKey();
      let record = storage.getRecordForDate(todayKey);
      if (record && record.hasCheckIn()) { showToast('บันทึกเข้างานแล้ววันนี้'); return; }
      if (!record) record = new WorkDayRecord(todayKey, currentTime(), '', '', ShiftType.AUTO);
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
      const shift = $('shiftSelect').value;
      const checkIn = $('editCheckIn').value || '';
      const checkOut = $('editCheckOut').value || '';
      const note = $('editNote').value.trim();
      if (shift === ShiftType.HOLIDAY) {
        storage.saveRecord(new WorkDayRecord(dateKey, '', '', note, shift));
        showToast('บันทึกข้อมูลแล้ว');
        updateSavedPreview();
        return;
      }
      if (checkOut && !checkIn) { showToast('กรุณาบันทึกเข้างานก่อน'); return; }
      if (checkIn && checkOut && !isCheckOutAfterCheckIn(checkIn, checkOut)) {
        showToast('เวลาออกงานต้องหลังเวลาเข้างาน');
        return;
      }
      storage.saveRecord(new WorkDayRecord(dateKey, checkIn, checkOut, note, shift));
      showToast('บันทึกข้อมูลแล้ว');
      updateSavedPreview();
      updatePreview();
    }

    function clearDayDetail() {
      storage.deleteRecord(state.detailDateKey);
      $('editCheckIn').value = '';
      $('editCheckOut').value = '';
      $('editNote').value = '';
      $('shiftSelect').value = ShiftType.AUTO;
      $('previewDuration').classList.add('hidden');
      $('previewWage').classList.add('hidden');
      $('savedPreviewCard').classList.add('hidden');
      showToast('ล้างข้อมูลแล้ว');
    }

    function exportData() {
      const json = storage.exportRecords();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).then(function () {
          showToast('คัดลอกข้อมูลแล้ว');
        }).catch(function () {
          $('importExportArea').value = json;
          $('importExportArea').classList.remove('hidden');
          showToast('เลือกข้อความแล้วคัดลอกด้วยตนเอง');
        });
      } else {
        $('importExportArea').value = json;
        $('importExportArea').classList.remove('hidden');
        showToast('เลือกข้อความแล้วคัดลอกด้วยตนเอง');
      }
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
        const count = storage.importRecords($('importExportArea').value);
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
    $('btnBack').addEventListener('click', function () { navigate('calendar'); });
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
    $('editCheckIn').addEventListener('input', updatePreview);
    $('editCheckOut').addEventListener('input', updatePreview);
    $('shiftSelect').addEventListener('change', function () {
      updateTimeFieldsVisibility();
      updatePreview();
    });
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
