(function () {
  'use strict';

  // ===== 常量与状态 =====
  const CATEGORY_ICONS = {
    '餐饮': '🍜',
    '交通': '🚌',
    '购物': '🛍️',
    '居住': '🏠',
    '娱乐': '🎮',
    '医疗': '💊',
    '其他': '📦',
    '工资': '💰',
    '奖金': '🎁',
    '理财': '📈'
  };

  const EXPENSE_CATEGORIES = ['餐饮', '交通', '购物', '居住', '娱乐', '医疗', '其他'];
  const INCOME_CATEGORIES = ['工资', '奖金', '理财', '其他'];

  const state = {
    currentMonth: getCurrentMonth(),
    typeFilter: 'all',
    categoryFilter: '全部',
    records: [],
    selectMode: false,
    selectedIds: new Set()
  };

  // ===== DOM 引用 =====
  const $ = (id) => document.getElementById(id);
  const els = {
    monthTitle: $('monthTitle'),
    prevMonth: $('prevMonth'),
    nextMonth: $('nextMonth'),
    totalIncome: $('totalIncome'),
    totalExpense: $('totalExpense'),
    balance: $('balance'),
    categoryStats: $('categoryStats'),
    recordList: $('recordList'),
    typeFilter: $('typeFilter'),
    categoryFilter: $('categoryFilter'),
    addBtn: $('addBtn'),
    modalOverlay: $('modalOverlay'),
    closeModal: $('closeModal'),
    recordForm: $('recordForm'),
    amount: $('amount'),
    category: $('category'),
    date: $('date'),
    note: $('note'),
    selectModeBtn: $('selectModeBtn'),
    batchDeleteBtn: $('batchDeleteBtn'),
    batchBar: $('batchBar'),
    selectedCount: $('selectedCount'),
    selectAllBtn: $('selectAllBtn'),
    confirmBatchDelete: $('confirmBatchDelete'),
    cancelBatchBtn: $('cancelBatchBtn')
  };

  // ===== 工具函数 =====
  function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function formatMonth(month) {
    const [y, m] = month.split('-');
    return `${y}年${Number(m)}月`;
  }

  function formatMoney(amount) {
    return `¥${Number(amount).toFixed(2)}`;
  }

  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${Number(m)}月${Number(d)}日`;
  }

  function formatWeekday(dateStr) {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const date = new Date(dateStr + 'T00:00:00');
    return `周${weekdays[date.getDay()]}`;
  }

  function getCategoryIcon(category) {
    return CATEGORY_ICONS[category] || '📌';
  }

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  async function api(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      let errMsg = '请求失败';
      try {
        const data = await res.json();
        errMsg = data.error || errMsg;
      } catch (e) { /* ignore */ }
      throw new Error(errMsg);
    }
    return res.json();
  }

  // ===== 数据加载 =====
  async function loadData() {
    // 并行加载统计与记录
    const [stats, records] = await Promise.all([
      api(`/api/stats?month=${state.currentMonth}`),
      api(`/api/records?month=${state.currentMonth}&category=${encodeURIComponent(state.categoryFilter)}&type=${state.typeFilter}`)
    ]);

    state.records = records;
    renderStats(stats);
    renderRecords(stats);
  }

  // 饼图配色（按分类名固定分配，视觉稳定）
  const PIE_COLORS = [
    '#4f6ef7', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
    '#f97316', '#6366f1', '#14b8a6', '#d946ef'
  ];

  function getCategoryColor(category, index) {
    // 预定义分类固定颜色映射
    const COLOR_MAP = {
      '餐饮': '#f59e0b',
      '交通': '#06b6d4',
      '购物': '#ec4899',
      '居住': '#8b5cf6',
      '娱乐': '#f97316',
      '医疗': '#ef4444',
      '其他': '#9ca3af',
      '工资': '#10b981',
      '奖金': '#84cc16',
      '理财': '#4f6ef7'
    };
    return COLOR_MAP[category] || PIE_COLORS[index % PIE_COLORS.length];
  }

  // 饼图交互状态
  const pieState = {
    canvas: null,
    ctx: null,
    segments: [],
    centerX: 0,
    centerY: 0,
    radius: 0,
    selectedIndex: -1,
    totalExpense: 0
  };

  // ===== 渲染统计 =====
  function renderStats(stats) {
    els.monthTitle.textContent = formatMonth(stats.month);
    els.totalIncome.textContent = formatMoney(stats.totalIncome);
    els.totalExpense.textContent = formatMoney(stats.totalExpense);
    els.balance.textContent = formatMoney(stats.balance);

    // 分类占比饼图
    els.categoryStats.innerHTML = '';
    if (stats.categoryStats.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-tip';
      empty.textContent = '本月暂无支出记录';
      els.categoryStats.appendChild(empty);
      return;
    }

    const totalExpense = stats.totalExpense;

    // 计算扇区数据
    const segments = stats.categoryStats.map((cat, i) => {
      const percent = (cat.amount / totalExpense) * 100;
      return {
        cat,
        percent,
        amount: cat.amount,
        color: getCategoryColor(cat.category, i),
        startAngle: 0,
        endAngle: 0
      };
    });

    // 容器
    const pieContainer = document.createElement('div');
    pieContainer.className = 'pie-container';

    // 图表（canvas + 中央信息）
    const chartWrap = document.createElement('div');
    chartWrap.className = 'pie-chart';

    const canvas = document.createElement('canvas');
    canvas.className = 'pie-canvas';
    chartWrap.appendChild(canvas);

    const hole = document.createElement('div');
    hole.className = 'pie-hole';
    hole.innerHTML = `
      <div class="pie-hole-label">总支出</div>
      <div class="pie-hole-percent">100%</div>
      <div class="pie-hole-amount">${formatMoney(totalExpense)}</div>
    `;
    chartWrap.appendChild(hole);

    // 图例
    const legend = document.createElement('div');
    legend.className = 'pie-legend';
    segments.forEach((seg, i) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-dot" style="background:${seg.color}"></span>
        <span class="legend-name">${esc(seg.cat.category)}</span>
        <span class="legend-amount">${formatMoney(seg.amount)}</span>
        <span class="legend-percent">${seg.percent.toFixed(1)}%</span>
      `;
      legend.appendChild(item);
    });

    pieContainer.appendChild(chartWrap);
    pieContainer.appendChild(legend);
    els.categoryStats.appendChild(pieContainer);

    // 保存状态并绘制
    pieState.canvas = canvas;
    pieState.segments = segments;
    pieState.selectedIndex = -1;
    pieState.totalExpense = totalExpense;

    drawPieChart();
    bindPieInteractions();
  }

  // 绘制饼图
  function drawPieChart() {
    const canvas = pieState.canvas;
    if (!canvas) return;

    const size = canvas.offsetWidth || 180;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 2;

    pieState.ctx = ctx;
    pieState.centerX = cx;
    pieState.centerY = cy;
    pieState.radius = radius;

    ctx.clearRect(0, 0, size, size);

    let startAngle = -Math.PI / 2; // 从12点方向开始顺时针
    pieState.segments.forEach((seg, i) => {
      const sweep = (seg.percent / 100) * Math.PI * 2;
      const endAngle = startAngle + sweep;
      seg.startAngle = startAngle;
      seg.endAngle = endAngle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      // 选中高亮，未选中变淡
      ctx.globalAlpha = (pieState.selectedIndex === -1 || pieState.selectedIndex === i) ? 1 : 0.3;
      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.globalAlpha = 1;

      // 白色分隔线
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      startAngle = endAngle;
    });
  }

  // 绑定饼图点击交互
  function bindPieInteractions() {
    // 点击扇区
    pieState.canvas.addEventListener('click', (e) => {
      const rect = pieState.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - pieState.centerX;
      const dy = y - pieState.centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > pieState.radius) return;

      // 角度（0~2π，从右侧顺时针）
      let angle = Math.atan2(dy, dx);
      angle = (angle + 2 * Math.PI) % (2 * Math.PI);

      for (let i = 0; i < pieState.segments.length; i++) {
        const seg = pieState.segments[i];
        const start = ((seg.startAngle + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const end = ((seg.endAngle + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

        let hit;
        if (start <= end) {
          hit = angle >= start && angle < end;
        } else {
          hit = angle >= start || angle < end;
        }
        if (hit) {
          selectPieSegment(i);
          return;
        }
      }
    });

    // 点击中央圆孔取消选中
    const hole = document.querySelector('.pie-hole');
    if (hole) {
      hole.addEventListener('click', () => {
        selectPieSegment(-1);
      });
    }

    // 点击图例选中对应分类
    document.querySelectorAll('.pie-legend .legend-item').forEach((item, i) => {
      item.addEventListener('click', () => {
        selectPieSegment(pieState.selectedIndex === i ? -1 : i);
      });
    });
  }

  // 选中/取消选中扇区，更新中央信息
  function selectPieSegment(index) {
    pieState.selectedIndex = index;

    const label = document.querySelector('.pie-hole-label');
    const percent = document.querySelector('.pie-hole-percent');
    const amount = document.querySelector('.pie-hole-amount');

    if (index === -1) {
      label.textContent = '总支出';
      percent.textContent = '100%';
      amount.textContent = formatMoney(pieState.totalExpense);
    } else {
      const seg = pieState.segments[index];
      label.textContent = seg.cat.category;
      percent.textContent = seg.percent.toFixed(1) + '%';
      amount.textContent = formatMoney(seg.amount);
    }

    // 图例高亮
    document.querySelectorAll('.pie-legend .legend-item').forEach((li, i) => {
      li.classList.toggle('active', i === index);
    });

    drawPieChart();
  }

  // ===== 渲染记录列表 =====
  function renderRecords(stats) {
    els.recordList.innerHTML = '';
    els.monthTitle.textContent = formatMonth(state.currentMonth);

    if (state.records.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-tip';
      empty.textContent = '暂无记录，点击下方「记一笔」开始记账吧';
      els.recordList.appendChild(empty);
      return;
    }

    // 按日期分组（记录已按日期倒序）
    const groups = {};
    state.records.forEach(r => {
      if (!groups[r.date]) groups[r.date] = [];
      groups[r.date].push(r);
    });

    const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    dates.forEach(date => {
      // 日汇总
      let dayIncome = 0;
      let dayExpense = 0;
      groups[date].forEach(r => {
        if (r.type === 'income') dayIncome += r.amount;
        else dayExpense += r.amount;
      });

      const dayHeader = document.createElement('div');
      dayHeader.className = 'record-day';
      const net = dayIncome - dayExpense;
      const dayNetText = net >= 0
        ? `结余 ${formatMoney(net)}`
        : `超支 ${formatMoney(Math.abs(net))}`;
      dayHeader.innerHTML = `
        <span>${formatDate(date)} ${formatWeekday(date)}</span>
        <span class="day-net">
          ${dayExpense > 0 ? `支 ${formatMoney(dayExpense)}` : ''}
          ${dayIncome > 0 ? `收 ${formatMoney(dayIncome)}` : ''}
          ${dayNetText}
        </span>
      `;
      els.recordList.appendChild(dayHeader);

      // 每条记录
      groups[date].forEach(r => {
        const item = document.createElement('div');
        item.className = 'record-item';
        item.dataset.id = r.id;

        const iconClass = r.type === 'income' ? 'income' : 'expense';
        const amountClass = r.type === 'income' ? 'income' : 'expense';
        const amountSymbol = r.type === 'income' ? '+' : '-';
        const isSelected = state.selectedIds.has(r.id);

        if (state.selectMode) {
          item.classList.add('selecting');
          if (isSelected) item.classList.add('selected');
        }

        item.innerHTML = `
          <div class="record-checkbox">${isSelected ? '✓' : ''}</div>
          <div class="record-icon ${iconClass}">${getCategoryIcon(r.category)}</div>
          <div class="record-info">
            <div class="record-category">${esc(r.category)}</div>
            <div class="record-note">${r.note ? esc(r.note) : r.type === 'income' ? '收入' : '支出'}</div>
          </div>
          <div class="record-amount ${amountClass}">${amountSymbol}${formatMoney(r.amount).slice(1)}</div>
          ${state.selectMode ? '' : `<button class="record-delete" data-id="${r.id}" aria-label="删除">✕</button>`}
        `;
        els.recordList.appendChild(item);
      });
    });

    // 单条删除按钮事件
    els.recordList.querySelectorAll('.record-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (!confirm('确定删除这条记录吗？')) return;
        try {
          await api(`/api/records/${id}`, { method: 'DELETE' });
          await loadData();
        } catch (err) {
          alert('删除失败：' + err.message);
        }
      });
    });

    // 选择模式：点击记录切换选中状态
    if (state.selectMode) {
      els.recordList.querySelectorAll('.record-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          if (state.selectedIds.has(id)) {
            state.selectedIds.delete(id);
            item.classList.remove('selected');
            item.querySelector('.record-checkbox').textContent = '';
          } else {
            state.selectedIds.add(id);
            item.classList.add('selected');
            item.querySelector('.record-checkbox').textContent = '✓';
          }
          updateSelectedCount();
        });
      });
    }
  }

  // ===== 筛选 =====
  function bindFilters() {
    // 类型筛选
    els.typeFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      els.typeFilter.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.typeFilter = btn.dataset.type;
      loadData().catch(showError);
    });

    // 分类筛选
    els.categoryFilter.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      els.categoryFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.categoryFilter = chip.dataset.category;
      loadData().catch(showError);
    });
  }

  // ===== 月份切换 =====
  function bindMonthSwitch() {
    els.prevMonth.addEventListener('click', () => {
      state.currentMonth = shiftMonth(state.currentMonth, -1);
      loadData().catch(showError);
    });
    els.nextMonth.addEventListener('click', () => {
      state.currentMonth = shiftMonth(state.currentMonth, 1);
      loadData().catch(showError);
    });
  }

  function shiftMonth(month, delta) {
    const [y, m] = month.split('-').map(Number);
    const total = y * 12 + (m - 1) + delta;
    const newY = Math.floor(total / 12);
    const newM = (total % 12) + 1;
    return `${newY}-${String(newM).padStart(2, '0')}`;
  }

  // ===== 录入弹窗 =====
  function bindModal() {
    const openModal = () => {
      // 重置表单
      els.recordForm.reset();
      setFormType('expense');
      els.date.value = toInputDate(new Date());
      els.modalOverlay.classList.add('show');
      // 延迟聚焦金额输入
      setTimeout(() => els.amount.focus(), 250);
    };

    const closeModal = () => {
      els.modalOverlay.classList.remove('show');
    };

    els.addBtn.addEventListener('click', openModal);
    els.closeModal.addEventListener('click', closeModal);
    els.modalOverlay.addEventListener('click', (e) => {
      if (e.target === els.modalOverlay) closeModal();
    });

    // 类型切换按钮
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setFormType(btn.dataset.formType);
      });
    });

    // 表单提交
    els.recordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formType = document.querySelector('.type-btn.active').dataset.formType;
      const payload = {
        date: els.date.value,
        type: formType,
        category: els.category.value,
        amount: els.amount.value,
        note: els.note.value
      };

      try {
        await api('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        closeModal();
        // 若录入的日期不在当前查看月份，跳到该月
        const recordMonth = payload.date.slice(0, 7);
        if (recordMonth !== state.currentMonth) {
          state.currentMonth = recordMonth;
        }
        // 重置筛选为「全部」，便于看到新记录
        state.typeFilter = 'all';
        state.categoryFilter = '全部';
        resetFilterButtons();
        await loadData();
      } catch (err) {
        alert('保存失败：' + err.message);
      }
    });
  }

  function setFormType(type) {
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.formType === type);
    });

    // 切换分类选项
    const currentValue = els.category.value;
    const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    els.category.innerHTML = '';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      els.category.appendChild(opt);
    });
    // 如果当前分类在新分类列表中则保留，否则选第一个
    if (categories.includes(currentValue)) {
      els.category.value = currentValue;
    }
  }

  function resetFilterButtons() {
    els.typeFilter.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === 'all');
    });
    els.categoryFilter.querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('active', c.dataset.category === '全部');
    });
  }

  function toInputDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  // ===== 批量删除 =====
  function bindBatchDelete() {
    // 进入选择模式
    els.selectModeBtn.addEventListener('click', () => {
      enterSelectMode();
    });

    // 批量删除按钮（选择模式下显示）
    els.batchDeleteBtn.addEventListener('click', () => {
      enterSelectMode();
    });

    // 全选
    els.selectAllBtn.addEventListener('click', () => {
      const allSelected = state.records.every(r => state.selectedIds.has(r.id));
      if (allSelected) {
        state.selectedIds.clear();
      } else {
        state.records.forEach(r => state.selectedIds.add(r.id));
      }
      renderRecords();
      updateSelectedCount();
    });

    // 确认批量删除
    els.confirmBatchDelete.addEventListener('click', async () => {
      if (state.selectedIds.size === 0) {
        alert('请先选择要删除的记录');
        return;
      }
      if (!confirm(`确定删除选中的 ${state.selectedIds.size} 条记录吗？`)) return;

      try {
        await api('/api/records/batch-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(state.selectedIds) })
        });
        exitSelectMode();
        await loadData();
      } catch (err) {
        alert('批量删除失败：' + err.message);
      }
    });

    // 取消选择模式
    els.cancelBatchBtn.addEventListener('click', () => {
      exitSelectMode();
    });
  }

  function enterSelectMode() {
    state.selectMode = true;
    state.selectedIds.clear();
    els.selectModeBtn.style.display = 'none';
    els.batchDeleteBtn.style.display = 'inline-block';
    els.batchBar.style.display = 'flex';
    updateSelectedCount();
    renderRecords();
  }

  function exitSelectMode() {
    state.selectMode = false;
    state.selectedIds.clear();
    els.selectModeBtn.style.display = 'inline-block';
    els.batchDeleteBtn.style.display = 'none';
    els.batchBar.style.display = 'none';
    renderRecords();
  }

  function updateSelectedCount() {
    els.selectedCount.textContent = `已选 ${state.selectedIds.size} 项`;
  }

  // ===== 错误提示 =====
  function showError(err) {
    console.error(err);
    els.recordList.innerHTML = `<div class="empty-tip">加载失败：${esc(err.message)}</div>`;
  }

  // ===== 初始化 =====
  function init() {
    bindFilters();
    bindMonthSwitch();
    bindModal();
    bindBatchDelete();
    loadData().catch(showError);
  }

  init();
})();