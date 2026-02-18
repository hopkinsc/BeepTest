const transcriptInput = document.getElementById('transcriptInput');
const startListeningBtn = document.getElementById('startListeningBtn');
const stopListeningBtn = document.getElementById('stopListeningBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const clearBtn = document.getElementById('clearBtn');
const exportPptBtn = document.getElementById('exportPptBtn');
const listenStatus = document.getElementById('listenStatus');

const actionsList = document.getElementById('actionsList');
const scopeList = document.getElementById('scopeList');
const raidContainer = document.getElementById('raidContainer');
const delegationList = document.getElementById('delegationList');

let recognition;
let analysisSnapshot = createEmptySnapshot();

const actionSignals = ['will', 'todo', 'to do', 'action', 'follow up', 'next step', 'need to'];
const scopeSignals = [
  'scope',
  'out of scope',
  'change request',
  'timeline impact',
  'budget impact',
  'new requirement',
  'stretch goal',
  'add feature',
];
const raidMatchers = [
  { type: 'Risk', regex: /(risk|might|could|threat|uncertain|uncertainty)/i },
  { type: 'Issue', regex: /(issue|blocked|blocking|problem|bug|delay|late)/i },
  { type: 'Assumption', regex: /(assume|assuming|expected to|if we get|presume)/i },
  { type: 'Dependency', regex: /(depends on|dependency|waiting on|vendor|external team|approval from)/i },
];

function createEmptySnapshot() {
  return {
    actions: [],
    scopeItems: [],
    raidItems: [],
    delegations: [],
  };
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    listenStatus.textContent = 'Web Speech API unavailable in this browser. Paste transcript manually.';
    startListeningBtn.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    listenStatus.textContent = 'Listening... speak naturally to capture meeting content.';
    startListeningBtn.disabled = true;
    stopListeningBtn.disabled = false;
  };

  recognition.onresult = (event) => {
    let finalChunk = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) {
        finalChunk += `${result[0].transcript.trim()} `;
      }
    }
    if (finalChunk) {
      transcriptInput.value = `${transcriptInput.value} ${finalChunk}`.trim();
    }
  };

  recognition.onerror = (event) => {
    listenStatus.textContent = `Speech recognition error: ${event.error}. Continue with pasted transcript if needed.`;
  };

  recognition.onend = () => {
    startListeningBtn.disabled = false;
    stopListeningBtn.disabled = true;
    if (listenStatus.textContent.startsWith('Listening')) {
      listenStatus.textContent = 'Microphone idle.';
    }
  };
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function detectAction(sentence) {
  const normalized = sentence.toLowerCase();
  const hasSignal = actionSignals.some((signal) => normalized.includes(signal));
  if (!hasSignal || sentence.length < 20) {
    return null;
  }

  const ownerMatch = sentence.match(/\b([A-Z][a-z]+)\s+(will|to|can|should)\b/);
  return {
    text: sentence,
    owner: ownerMatch ? ownerMatch[1] : 'TBD',
    due: inferDueDate(sentence),
  };
}

function detectScopeImpact(sentence) {
  const normalized = sentence.toLowerCase();
  const hasSignal = scopeSignals.some((signal) => normalized.includes(signal));
  return hasSignal ? sentence : null;
}

function detectRaid(sentence) {
  const matcher = raidMatchers.find(({ regex }) => regex.test(sentence));
  if (!matcher) {
    return null;
  }

  return {
    type: matcher.type,
    description: sentence,
    owner: inferOwner(sentence),
    mitigation: inferMitigation(sentence, matcher.type),
  };
}

function inferOwner(sentence) {
  const ownerMatch = sentence.match(/\b([A-Z][a-z]+)\b/);
  return ownerMatch ? ownerMatch[1] : 'Project team';
}

function inferDueDate(sentence) {
  const dueMatch = sentence.match(/\b(by|before|on)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|next week|EOW|end of month)\b/i);
  return dueMatch ? `${dueMatch[1]} ${dueMatch[2]}` : 'No explicit date';
}

function inferMitigation(sentence, type) {
  if (type === 'Risk') {
    return 'Define contingency and monitor weekly.';
  }
  if (type === 'Issue') {
    return 'Escalate quickly and assign an immediate owner.';
  }
  if (type === 'Assumption') {
    return 'Validate with stakeholders and record decision.';
  }
  if (type === 'Dependency') {
    return 'Track externally and set follow-up checkpoints.';
  }
  return sentence;
}

function buildDelegations(actions) {
  return actions.map((action) => {
    const suggestion =
      action.owner === 'TBD'
        ? `Unassigned task: "${action.text}" → suggest assigning to PM for triage.`
        : `${action.owner}: take ownership of "${action.text}" (${action.due}).`;
    return suggestion;
  });
}

function analyzeTranscript() {
  const text = transcriptInput.value.trim();
  if (!text) {
    listenStatus.textContent = 'Add or capture transcript text before analysis.';
    return;
  }

  const sentences = splitSentences(text);
  const snapshot = createEmptySnapshot();

  sentences.forEach((sentence) => {
    const action = detectAction(sentence);
    if (action) {
      snapshot.actions.push(action);
    }

    const scope = detectScopeImpact(sentence);
    if (scope) {
      snapshot.scopeItems.push(scope);
    }

    const raid = detectRaid(sentence);
    if (raid) {
      snapshot.raidItems.push(raid);
    }
  });

  snapshot.delegations = buildDelegations(snapshot.actions);
  analysisSnapshot = snapshot;
  renderSnapshot(snapshot);
  listenStatus.textContent = `Analyzed ${sentences.length} transcript statements.`;
}

function renderEmptyState(container, message, tag = 'p') {
  container.innerHTML = '';
  const node = document.createElement(tag);
  node.className = 'empty';
  node.textContent = message;
  container.appendChild(node);
}

function renderList(container, items, formatter) {
  container.innerHTML = '';
  if (!items.length) {
    renderEmptyState(container, 'No items detected yet.', 'li');
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = formatter(item);
    container.appendChild(li);
  });
}

function renderRaidTable(items) {
  raidContainer.innerHTML = '';
  if (!items.length) {
    renderEmptyState(raidContainer, 'No RAID signals detected yet.');
    return;
  }

  const table = document.createElement('table');
  table.className = 'raid-table';

  table.innerHTML = `
    <thead>
      <tr>
        <th>Type</th>
        <th>Description</th>
        <th>Owner</th>
        <th>Mitigation</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item) => `
            <tr>
              <td><span class="badge badge-${item.type.toLowerCase()}">${item.type}</span></td>
              <td>${item.description}</td>
              <td>${item.owner}</td>
              <td>${item.mitigation}</td>
            </tr>
          `,
        )
        .join('')}
    </tbody>
  `;

  raidContainer.appendChild(table);
}

function renderSnapshot(snapshot) {
  renderList(
    actionsList,
    snapshot.actions,
    (item) => `<strong>${item.owner}</strong>: ${item.text}<br/><small>Due: ${item.due}</small>`,
  );
  renderList(scopeList, snapshot.scopeItems, (item) => item);
  renderRaidTable(snapshot.raidItems);
  renderList(delegationList, snapshot.delegations, (item) => item);
}

function resetWorkspace() {
  transcriptInput.value = '';
  analysisSnapshot = createEmptySnapshot();
  renderSnapshot(analysisSnapshot);
  listenStatus.textContent = 'Workspace cleared.';
}

function exportProjectPlanPpt() {
  if (!window.PptxGenJS) {
    listenStatus.textContent = 'PptxGenJS failed to load. Check connectivity and retry.';
    return;
  }

  const pptx = new window.PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Meeting Scope & RAID Planner';
  pptx.subject = 'Automatically extracted project plan';
  pptx.title = 'Meeting Project Plan';

  const summarySlide = pptx.addSlide();
  summarySlide.background = { color: 'F7F9FF' };
  summarySlide.addText('Project Plan Summary', {
    x: 0.4,
    y: 0.3,
    w: 9,
    h: 0.5,
    fontSize: 28,
    bold: true,
    color: '1C2340',
  });

  summarySlide.addText(
    [
      { text: `Actions: ${analysisSnapshot.actions.length}\n` },
      { text: `Scope impacts: ${analysisSnapshot.scopeItems.length}\n` },
      { text: `RAID items: ${analysisSnapshot.raidItems.length}\n` },
      { text: `Delegation suggestions: ${analysisSnapshot.delegations.length}` },
    ],
    { x: 0.5, y: 1.2, w: 5.7, h: 2.2, fontSize: 18, color: '2B3558' },
  );

  summarySlide.addShape(pptx.ShapeType.roundRect, {
    x: 6.3,
    y: 1.2,
    w: 6.4,
    h: 2.4,
    fill: { color: 'E9EFFF' },
    line: { color: 'D4DEFF' },
    radius: 0.08,
  });

  summarySlide.addText('Top Scope Mentions', {
    x: 6.5,
    y: 1.35,
    w: 3,
    h: 0.3,
    fontSize: 16,
    bold: true,
    color: '1C2340',
  });

  const scopeText = analysisSnapshot.scopeItems.slice(0, 4).map((item, idx) => `${idx + 1}. ${item}`).join('\n');
  summarySlide.addText(scopeText || 'None identified.', {
    x: 6.5,
    y: 1.8,
    w: 5.8,
    h: 1.6,
    fontSize: 12,
    color: '2D3D67',
    valign: 'top',
  });

  const raidSlide = pptx.addSlide();
  raidSlide.addText('RAID Register', {
    x: 0.4,
    y: 0.3,
    w: 5,
    h: 0.5,
    fontSize: 24,
    bold: true,
  });

  const raidRows = analysisSnapshot.raidItems.length
    ? analysisSnapshot.raidItems.map((item) => [item.type, item.description, item.owner, item.mitigation])
    : [['-', 'No RAID items detected in transcript.', '-', '-']];

  raidSlide.addTable([['Type', 'Description', 'Owner', 'Mitigation'], ...raidRows], {
    x: 0.4,
    y: 1,
    w: 12.2,
    h: 4.8,
    colW: [1.1, 5.3, 2.2, 3.6],
    fontSize: 11,
    border: { type: 'solid', pt: 1, color: 'D8DEEF' },
    fill: 'FFFFFF',
    color: '1E294A',
    valign: 'top',
  });

  const actionsSlide = pptx.addSlide();
  actionsSlide.addText('Action Plan & Delegation', {
    x: 0.4,
    y: 0.3,
    w: 7,
    h: 0.5,
    fontSize: 24,
    bold: true,
  });

  const actionBullets = analysisSnapshot.actions.slice(0, 8).map((item) => ({
    text: `${item.owner}: ${item.text} (${item.due})`,
    options: { bullet: { indent: 12 } },
  }));

  actionsSlide.addText(actionBullets.length ? actionBullets : [{ text: 'No actions captured yet.' }], {
    x: 0.6,
    y: 1,
    w: 6,
    h: 4.5,
    fontSize: 14,
    color: '22335B',
  });

  const delegationBullets = analysisSnapshot.delegations.slice(0, 8).map((item) => ({
    text: item,
    options: { bullet: { indent: 12 } },
  }));

  actionsSlide.addShape(pptx.ShapeType.roundRect, {
    x: 6.9,
    y: 0.95,
    w: 5.6,
    h: 4.8,
    fill: { color: 'EEF4FF' },
    line: { color: 'CEDCF9' },
  });

  actionsSlide.addText('Suggested Delegations', {
    x: 7.2,
    y: 1.2,
    w: 4,
    h: 0.3,
    fontSize: 15,
    bold: true,
    color: '1C2B57',
  });

  actionsSlide.addText(delegationBullets.length ? delegationBullets : [{ text: 'No delegations available.' }], {
    x: 7.2,
    y: 1.55,
    w: 4.9,
    h: 3.9,
    fontSize: 12,
    color: '2A3B62',
  });

  const filename = `project-plan-${new Date().toISOString().slice(0, 10)}.pptx`;
  pptx.writeFile({ fileName: filename });
  listenStatus.textContent = `PowerPoint generated: ${filename}`;
}

startListeningBtn.addEventListener('click', () => {
  if (recognition) {
    recognition.start();
  }
});

stopListeningBtn.addEventListener('click', () => {
  if (recognition) {
    recognition.stop();
  }
});

analyzeBtn.addEventListener('click', analyzeTranscript);
clearBtn.addEventListener('click', resetWorkspace);
exportPptBtn.addEventListener('click', exportProjectPlanPpt);

setupSpeechRecognition();
renderSnapshot(analysisSnapshot);
