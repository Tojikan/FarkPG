// FarkPG Character Builder
(function() {
  'use strict';

  // State
  let currentTheme = null;
  let character = null;
  let builderMode = false;

  // DOM Elements
  let sheetContainer, builderModal, builderContent, pasteModal;

  // Initialize
  function init() {
    sheetContainer = document.getElementById('character-sheet');
    builderModal = document.getElementById('builder-modal');
    builderContent = document.getElementById('builder-content');
    pasteModal = document.getElementById('paste-modal');

    // Load default theme
    if (window.Themes && window.Themes.Basic) {
      loadTheme(window.Themes.Basic);
    }

    // Event listeners
    document.getElementById('open-builder').addEventListener('click', openBuilder);
    document.getElementById('close-builder').addEventListener('click', closeBuilder);
    document.getElementById('export-btn').addEventListener('click', exportCharacter);
    document.getElementById('copy-btn').addEventListener('click', copyToClipboard);
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importCharacter);
    document.getElementById('paste-btn').addEventListener('click', openPasteModal);
    document.getElementById('close-paste').addEventListener('click', closePasteModal);
    document.getElementById('paste-cancel').addEventListener('click', closePasteModal);
    document.getElementById('paste-confirm').addEventListener('click', confirmPaste);
    document.getElementById('print-btn').addEventListener('click', printSheet);

    // Actions dropdown
    const actionsTrigger = document.getElementById('actions-trigger');
    const actionsMenu = document.getElementById('actions-menu');
    if (actionsTrigger && actionsMenu) {
      actionsTrigger.addEventListener('click', function(e) {
        e.stopPropagation();
        actionsMenu.classList.toggle('open');
      });
      actionsMenu.addEventListener('click', function() {
        actionsMenu.classList.remove('open');
      });
      document.addEventListener('click', function() {
        actionsMenu.classList.remove('open');
      });
    }

    // Close modal on click outside or Escape key
    builderModal.addEventListener('click', function(e) {
      if (e.target === builderModal) {
        closeBuilder();
      }
    });
    pasteModal.addEventListener('click', function(e) {
      if (e.target === pasteModal) {
        closePasteModal();
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        if (pasteModal.classList.contains('open')) {
          closePasteModal();
        } else if (builderMode) {
          closeBuilder();
        }
      }
    });

    renderSheet();
  }

  // Load a theme
  function loadTheme(theme) {
    currentTheme = theme;
    character = createEmptyCharacter(theme);
    renderSheet();
  }

  // Create empty character from theme
  function createEmptyCharacter(theme) {
    const char = {
      name: "",
      health: { current: theme.health.max, max: theme.health.max },
      points: JSON.parse(JSON.stringify(theme.points)),
      attributes: {},
      skills: {},
      abilities: {},
      custom: { skills: {}, abilities: [] }
    };

    // Initialize attributes with defaults
    theme.attributes.forEach(attr => {
      char.attributes[attr.id] = attr.default || attr.min || 0;
    });

    // Initialize skills by category
    Object.keys(theme.skills).forEach(catId => {
      char.skills[catId] = {};
      theme.skills[catId].skills.forEach(skill => {
        char.skills[catId][skill.id] = 0;
      });
      char.custom.skills[catId] = [];
    });

    // Initialize abilities (0 = not taken, 1+ = level for levelable abilities)
    theme.abilities.forEach(ability => {
      char.abilities[ability.id] = 0;
    });

    return char;
  }

  // Calculate spent points
  function getSpentPoints(type, category) {
    if (type === 'attributes') {
      // Count all allocated attribute points (defaults count as spent)
      let spent = 0;
      currentTheme.attributes.forEach(attr => {
        spent += character.attributes[attr.id];
      });
      return spent;
    } else if (type === 'skills' && category) {
      const themeSkills = Object.values(character.skills[category] || {}).reduce((a, b) => a + b, 0);
      const customSkills = (character.custom.skills[category] || []).reduce((a, b) => a + b.value, 0);
      return themeSkills + customSkills;
    } else if (type === 'abilities') {
      // Sum costs of enabled abilities (level * cost for levelable)
      let spent = 0;
      currentTheme.abilities.forEach(ability => {
        const level = character.abilities[ability.id] || 0;
        if (level > 0) {
          const baseCost = ability.cost || 1;
          spent += baseCost * level;
        }
      });
      // Custom abilities have their own cost (level * cost if levelable)
      character.custom.abilities.forEach(ca => {
        const cost = ca.cost || 1;
        const level = ca.levelable ? (ca.level || 1) : 1;
        spent += cost * level;
      });
      return spent;
    }
    return 0;
  }

  function getRemainingPoints(type, category) {
    if (type === 'attributes') {
      return character.points.attributes - getSpentPoints('attributes');
    } else if (type === 'skills' && category) {
      return (character.points.skills[category] || 0) - getSpentPoints('skills', category);
    } else if (type === 'abilities') {
      return character.points.abilities - getSpentPoints('abilities');
    }
    return 0;
  }

  // Check if skill category has any points
  function categoryHasPoints(catId) {
    const themePoints = Object.values(character.skills[catId] || {}).reduce((a, b) => a + b, 0);
    const customPoints = (character.custom.skills[catId] || []).reduce((a, b) => a + b.value, 0);
    return themePoints > 0 || customPoints > 0 || (character.custom.skills[catId] || []).length > 0;
  }

  // Render the character sheet (view mode)
  function renderSheet() {
    if (!currentTheme || !character) {
      sheetContainer.innerHTML = '<p>No theme loaded.</p>';
      return;
    }

    // Helper to get attribute abbreviation
    const getAttrAbbr = (attrId) => {
      const attr = currentTheme.attributes.find(a => a.id === attrId);
      return attr ? (attr.abbr || attr.label.substring(0, 3).toUpperCase()) : '';
    };

    const hasName = character.name && character.name.trim();
    
    let html = `
      <div class="sheet-header-row">
        <div class="name-section">
          <label class="sheet-label">Name</label>
          <div class="sheet-value name-value ${hasName ? '' : 'placeholder'}">${hasName ? character.name : '(Character Name)'}</div>
        </div>
        <div class="health-box">
          <label class="sheet-label">Health</label>
          <div class="health-display">
            <input type="number" class="health-current" value="${character.health.current}" 
                   onchange="CharacterBuilder.setHealth(this.value)" />
            <span class="health-sep">/</span>
            <span class="health-max">${character.health.max}</span>
          </div>
          <div class="health-adjust">
            <input type="number" id="health-add-input" class="health-add-input" value="0" />
            <button class="health-add-btn" onclick="CharacterBuilder.addHealth()">Add</button>
            <button class="health-reset-btn" onclick="CharacterBuilder.resetHealth()">↺</button>
          </div>
        </div>
      </div>

      <div class="sheet-main">
        <div class="attributes-bar">
          <h3>Attributes</h3>
          ${currentTheme.attributes.map(attr => `
            <div class="attr-item">
              <span class="attr-label">${attr.label}</span>
              <span class="attr-value">${character.attributes[attr.id]}</span>
            </div>
          `).join('')}
        </div>

        <div class="skills-section">
          <h3>Skills</h3>
          <div class="skills-columns">
            ${Object.keys(currentTheme.skills).map(catId => {
              const cat = currentTheme.skills[catId];
              const shouldDisplay = cat.alwaysDisplay || categoryHasPoints(catId);
              if (!shouldDisplay) return '';
              
              return `
                <div class="skill-category-box">
                  <h4>${cat.label}</h4>
                  <div class="skills-list">
                    ${cat.skills.map(skill => {
                      const value = character.skills[catId][skill.id];
                      if (!cat.alwaysDisplay && value === 0) return '';
                      const attrAbbr = skill.attribute ? getAttrAbbr(skill.attribute) : '';
                      const tooltip = skill.description ? `title="${skill.description}"` : '';
                      return `
                        <div class="skill-item" ${tooltip}>
                          <span class="skill-label">
                            ${skill.label}
                            ${attrAbbr ? `<span class="skill-attr">[${attrAbbr}]</span>` : ''}
                          </span>
                          <span class="skill-value">${value}</span>
                        </div>
                      `;
                    }).join('')}
                    ${(character.custom.skills[catId] || []).filter(cs => cs.value > 0).map(cs => {
                      const tooltip = cs.description ? `title="${cs.description}"` : '';
                      const csAttr = cs.attribute ? currentTheme.attributes.find(a => a.id === cs.attribute) : null;
                      const csAttrAbbr = csAttr ? (csAttr.abbr || csAttr.label.substring(0, 3).toUpperCase()) : '';
                      return `
                        <div class="skill-item custom" ${tooltip}>
                          <span class="skill-label">
                            ${cs.label}
                            ${csAttrAbbr ? `<span class="skill-attr">[${csAttrAbbr}]</span>` : ''}
                            <span class="custom-tag">(Custom)</span>
                          </span>
                          <span class="skill-value">${cs.value}</span>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="abilities-section">
        <h3>Abilities</h3>
        <div class="abilities-list">
          ${(() => {
            const activeAbilities = currentTheme.abilities.filter(a => character.abilities[a.id] > 0);
            const customAbilities = character.custom.abilities;
            if (activeAbilities.length === 0 && customAbilities.length === 0) {
              return '<p class="empty">No abilities selected</p>';
            }
            return activeAbilities.map(a => {
              const level = character.abilities[a.id];
              const totalCost = (a.cost || 1) * level;
              const levelText = a.levelable ? ` (Level ${level})` : '';
              return `
                <div class="ability-card">
                  <div class="ability-header">
                    <span class="ability-name">${a.label}${levelText}</span>
                    <span class="ability-cost">Cost: ${totalCost}</span>
                  </div>
                  <p class="ability-desc">${a.description}</p>
                </div>
              `;
            }).join('') +
            customAbilities.map(a => {
              const level = a.levelable ? (a.level || 1) : 1;
              const totalCost = (a.cost || 1) * level;
              const levelText = a.levelable ? ` (Level ${level})` : '';
              return `
                <div class="ability-card custom">
                  <div class="ability-header">
                    <span class="ability-name">
                      ${a.label}${levelText}
                      <span class="custom-tag">(Custom)</span>
                    </span>
                    <span class="ability-cost">Cost: ${totalCost}</span>
                  </div>
                  <p class="ability-desc">${a.description || ''}</p>
                </div>
              `;
            }).join('');
          })()}
        </div>
      </div>
    `;

    sheetContainer.innerHTML = html;
  }

  // Render the builder modal
  function renderBuilder() {
    if (!currentTheme || !character) return;

    let html = `
      <div class="builder-section">
        <label>Character Name</label>
        <input type="text" id="char-name" value="${character.name}" onchange="CharacterBuilder.setName(this.value)">
      </div>

      <div class="builder-section">
        <label>Max Health</label>
        <input type="number" id="max-health" value="${character.health.max}" onchange="CharacterBuilder.setMaxHealth(this.value)">
      </div>

      <div class="builder-section">
        <div class="section-header">
          <h3>Attributes</h3>
          <span class="points-display">Points: ${getRemainingPoints('attributes')}/<input type="number" class="points-input-inline" value="${character.points.attributes}" onchange="CharacterBuilder.setMaxPoints('attributes', null, this.value)"></span>
        </div>
        <div class="builder-grid-box attributes-box">
          <div class="attributes-grid">
            ${currentTheme.attributes.map(attr => {
              const min = attr.min || 0;
              const max = attr.max || 10;
              const val = character.attributes[attr.id];
              return `
                <div class="builder-item">
                  <span class="item-label">${attr.label} <small class="item-range">(${min}-${max})</small></span>
                  <div class="item-controls">
                    <button onclick="CharacterBuilder.adjustAttribute('${attr.id}', -1)" ${val <= min ? 'disabled' : ''}>−</button>
                    <span class="item-value">${val}</span>
                    <button onclick="CharacterBuilder.adjustAttribute('${attr.id}', 1)" ${val >= max ? 'disabled' : ''}>+</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    // Skills by category - render in 2-column grid of vertical boxes
    html += `<div class="builder-section">
      <div class="section-header">
        <h3>Skills</h3>
      </div>
      <div class="builder-grid">`;
    
    Object.keys(currentTheme.skills).forEach(catId => {
      const cat = currentTheme.skills[catId];
      const maxSkill = cat.max || 5;
      html += `
        <div class="builder-grid-box">
          <div class="skill-box-header">
            <h4>${cat.label}</h4>
            <span class="points-display-small">Points: ${getRemainingPoints('skills', catId)}/<input type="number" class="points-input-inline" value="${character.points.skills[catId] || 0}" onchange="CharacterBuilder.setMaxPoints('skills', '${catId}', this.value)"></span>
          </div>
          <div class="builder-list">
            ${cat.skills.map(skill => {
              const val = character.skills[catId][skill.id];
              const attr = skill.attribute ? currentTheme.attributes.find(a => a.id === skill.attribute) : null;
              const attrAbbr = attr ? (attr.abbr || attr.label.substring(0, 3).toUpperCase()) : '';
              const tooltip = skill.description ? `title="${skill.description}"` : '';
              return `
                <div class="builder-item" ${tooltip}>
                  <span class="item-label">
                    ${skill.label}
                    ${attrAbbr ? `<span class="skill-attr">[${attrAbbr}]</span>` : ''}
                  </span>
                  <div class="item-controls">
                    <button onclick="CharacterBuilder.adjustSkill('${catId}', '${skill.id}', -1)" ${val <= 0 ? 'disabled' : ''}>−</button>
                    <span class="item-value">${val}</span>
                    <button onclick="CharacterBuilder.adjustSkill('${catId}', '${skill.id}', 1)" ${val >= maxSkill ? 'disabled' : ''}>+</button>
                  </div>
                </div>
              `;
            }).join('')}
            ${(character.custom.skills[catId] || []).map((cs, i) => {
              const isEditing = cs.editing !== false;
              const tooltip = cs.description ? `title="${cs.description}"` : '';
              
              if (isEditing) {
                // Edit mode
                const attrOptions = currentTheme.attributes.map(attr => {
                  const abbr = attr.abbr || attr.label.substring(0, 3).toUpperCase();
                  const selected = cs.attribute === attr.id ? 'selected' : '';
                  return `<option value="${attr.id}" ${selected}>${abbr}</option>`;
                }).join('');
                
                return `
                  <div class="custom-item-edit">
                    <div class="custom-edit-row">
                      <input type="text" class="custom-edit-name" value="${cs.label}" 
                             onchange="CharacterBuilder.updateCustomSkill('${catId}', ${i}, 'label', this.value)" 
                             placeholder="Skill name">
                      <select class="custom-attr-select" onchange="CharacterBuilder.updateCustomSkill('${catId}', ${i}, 'attribute', this.value)">
                        <option value="">--</option>
                        ${attrOptions}
                      </select>
                      <div class="item-controls">
                        <button onclick="CharacterBuilder.adjustCustomSkill('${catId}', ${i}, -1)" ${cs.value <= 0 ? 'disabled' : ''}>−</button>
                        <span class="item-value">${cs.value}</span>
                        <button onclick="CharacterBuilder.adjustCustomSkill('${catId}', ${i}, 1)" ${cs.value >= maxSkill ? 'disabled' : ''}>+</button>
                      </div>
                    </div>
                    <textarea class="custom-edit-desc" placeholder="Description (optional)..." 
                              onchange="CharacterBuilder.updateCustomSkill('${catId}', ${i}, 'description', this.value)">${cs.description || ''}</textarea>
                    <div class="custom-edit-actions">
                      <button class="save-btn" onclick="CharacterBuilder.saveCustomSkill('${catId}', ${i})">Save</button>
                      <button class="delete-btn" onclick="CharacterBuilder.removeCustomSkill('${catId}', ${i})">Delete</button>
                    </div>
                  </div>
                `;
              } else {
                // View mode
                const csAttr = cs.attribute ? currentTheme.attributes.find(a => a.id === cs.attribute) : null;
                const csAttrAbbr = csAttr ? (csAttr.abbr || csAttr.label.substring(0, 3).toUpperCase()) : '';
                
                return `
                  <div class="builder-item custom" ${tooltip}>
                    <span class="item-label">
                      <button class="edit-icon" onclick="CharacterBuilder.editCustomSkill('${catId}', ${i})">✎</button>
                      ${cs.label}
                      ${csAttrAbbr ? `<span class="skill-attr">[${csAttrAbbr}]</span>` : ''}
                      <span class="custom-tag">(Custom)</span>
                    </span>
                    <div class="item-controls">
                      <button onclick="CharacterBuilder.adjustCustomSkill('${catId}', ${i}, -1)" ${cs.value <= 0 ? 'disabled' : ''}>−</button>
                      <span class="item-value">${cs.value}</span>
                      <button onclick="CharacterBuilder.adjustCustomSkill('${catId}', ${i}, 1)" ${cs.value >= maxSkill ? 'disabled' : ''}>+</button>
                    </div>
                  </div>
                `;
              }
            }).join('')}
          </div>
          <button class="add-custom-btn" onclick="CharacterBuilder.addCustomSkill('${catId}')">+ Add Custom</button>
        </div>
      `;
    });
    
    html += `</div></div>`;

    // Abilities with costs and levels
    html += `
      <div class="builder-section">
        <div class="section-header">
          <h3>Abilities</h3>
          <span class="points-display">Points: ${getRemainingPoints('abilities')}/<input type="number" class="points-input-inline" value="${character.points.abilities}" onchange="CharacterBuilder.setMaxPoints('abilities', null, this.value)"></span>
        </div>
        <div class="abilities-builder-list">
          ${currentTheme.abilities.map(ability => {
            const cost = ability.cost || 1;
            const level = character.abilities[ability.id] || 0;
            const isActive = level > 0;
            const totalCost = cost * level;
            const canAfford = getRemainingPoints('abilities') >= cost || isActive;
            const maxLevel = ability.maxLevel || 1;
            
            if (ability.levelable) {
              // Levelable ability with +/- controls above the name (same position as checkbox)
              return `
                <div class="ability-builder-card ${isActive ? 'selected' : ''} ${!canAfford ? 'disabled' : ''}">
                  <div class="ability-toggle levelable">
                    <div class="ability-level-controls">
                      <button onclick="CharacterBuilder.adjustAbilityLevel('${ability.id}', -1)" ${level <= 0 ? 'disabled' : ''}>−</button>
                      <span class="ability-level">${level}</span>
                      <button onclick="CharacterBuilder.adjustAbilityLevel('${ability.id}', 1)" ${level >= maxLevel || (!isActive && !canAfford) ? 'disabled' : ''}>+</button>
                    </div>
                    <div class="ability-info">
                      <div class="ability-header-row">
                        <span class="ability-name">${ability.label}</span>
                        <span class="ability-cost">Cost: ${cost}/lvl${isActive ? ` (${totalCost})` : ''}</span>
                      </div>
                      <p class="ability-desc">${ability.description}</p>
                    </div>
                  </div>
                </div>
              `;
            } else {
              // Non-levelable ability with checkbox
              return `
                <div class="ability-builder-card ${isActive ? 'selected' : ''} ${!canAfford ? 'disabled' : ''}">
                  <label class="ability-toggle">
                    <input type="checkbox" ${isActive ? 'checked' : ''} 
                           ${!canAfford && !isActive ? 'disabled' : ''}
                           onchange="CharacterBuilder.toggleAbility('${ability.id}')">
                    <div class="ability-info">
                      <div class="ability-header-row">
                        <span class="ability-name">${ability.label}</span>
                        <span class="ability-cost">Cost: ${cost}</span>
                      </div>
                      <p class="ability-desc">${ability.description}</p>
                    </div>
                  </label>
                </div>
              `;
            }
          }).join('')}
          ${character.custom.abilities.map((ca, i) => {
            const level = ca.level || 1;
            const cost = ca.cost || 1;
            const totalCost = cost * (ca.levelable ? level : 1);
            const isEditing = ca.editing !== false;
            
            if (isEditing) {
              // Edit mode
              return `
                <div class="custom-item-edit ability-edit">
                  <div class="custom-ability-row">
                    <div class="custom-field">
                      <label class="custom-field-label">Name</label>
                      <input type="text" class="custom-ability-name" value="${ca.label}" 
                             onchange="CharacterBuilder.updateCustomAbility(${i}, 'label', this.value)" placeholder="Ability name">
                    </div>
                    <div class="custom-field">
                      <label class="custom-field-label">Cost${ca.levelable ? '/lvl' : ''}</label>
                      <input type="number" class="custom-cost-input" value="${cost}" min="1"
                             onchange="CharacterBuilder.updateCustomAbility(${i}, 'cost', parseInt(this.value) || 1)">
                    </div>
                    <div class="custom-field levelable-field">
                      <label class="custom-field-label">Levelable</label>
                      <input type="checkbox" class="custom-levelable-check" ${ca.levelable ? 'checked' : ''}
                             onchange="CharacterBuilder.updateCustomAbility(${i}, 'levelable', this.checked)">
                    </div>
                  </div>
                  <textarea class="custom-ability-desc" placeholder="Description..." 
                            onchange="CharacterBuilder.updateCustomAbility(${i}, 'description', this.value)">${ca.description || ''}</textarea>
                  <div class="custom-edit-actions">
                    <button class="save-btn" onclick="CharacterBuilder.saveCustomAbility(${i})">Save</button>
                    <button class="delete-btn" onclick="CharacterBuilder.removeCustomAbility(${i})">Delete</button>
                  </div>
                </div>
              `;
            } else {
              // View mode - similar to theme abilities
              if (ca.levelable) {
                return `
                  <div class="ability-builder-card custom selected">
                    <div class="ability-toggle levelable">
                      <div class="ability-level-controls">
                        <button onclick="CharacterBuilder.adjustCustomAbilityLevel(${i}, -1)" ${level <= 1 ? 'disabled' : ''}>−</button>
                        <span class="ability-level">${level}</span>
                        <button onclick="CharacterBuilder.adjustCustomAbilityLevel(${i}, 1)">+</button>
                      </div>
                      <div class="ability-info">
                        <div class="ability-header-row">
                          <span class="ability-name">
                            <button class="edit-icon" onclick="CharacterBuilder.editCustomAbility(${i})">✎</button>
                            ${ca.label}
                            <span class="custom-tag">(Custom)</span>
                          </span>
                          <span class="ability-cost">Cost: ${cost}/lvl (${totalCost})</span>
                        </div>
                        <p class="ability-desc">${ca.description || ''}</p>
                      </div>
                    </div>
                  </div>
                `;
              } else {
                return `
                  <div class="ability-builder-card custom selected">
                    <div class="ability-toggle">
                      <div class="ability-info">
                        <div class="ability-header-row">
                          <span class="ability-name">
                            <button class="edit-icon" onclick="CharacterBuilder.editCustomAbility(${i})">✎</button>
                            ${ca.label}
                            <span class="custom-tag">(Custom)</span>
                          </span>
                          <span class="ability-cost">Cost: ${cost}</span>
                        </div>
                        <p class="ability-desc">${ca.description || ''}</p>
                      </div>
                    </div>
                  </div>
                `;
              }
            }
          }).join('')}
        </div>
        <button class="add-custom-btn" onclick="CharacterBuilder.addCustomAbility()">+ Add Custom Ability</button>
      </div>
    `;

    builderContent.innerHTML = html;
  }

  // Builder mode controls
  function openBuilder() {
    builderMode = true;
    builderModal.classList.add('open');
    renderBuilder();
  }

  function closeBuilder() {
    builderMode = false;
    builderModal.classList.remove('open');
    renderSheet();
  }

  // Print view
  function printSheet() {
    window.print();
  }

  // Character modification functions
  function setName(name) {
    character.name = name;
  }

  function setMaxHealth(val) {
    character.health.max = Math.max(1, parseInt(val) || 1);
    if (character.health.current > character.health.max) {
      character.health.current = character.health.max;
    }
  }

  function setHealth(val) {
    character.health.current = Math.max(0, parseInt(val) || 0);
    renderSheet();
  }

  function addHealth() {
    const input = document.getElementById('health-add-input');
    const amount = parseInt(input.value) || 0;
    character.health.current = Math.max(0, character.health.current + amount);
    renderSheet();
  }

  function resetHealth() {
    character.health.current = character.health.max;
    renderSheet();
  }

  function setMaxPoints(type, category, val) {
    const value = Math.max(0, parseInt(val) || 0);
    if (type === 'attributes') {
      character.points.attributes = value;
    } else if (type === 'skills' && category) {
      character.points.skills[category] = value;
    } else if (type === 'abilities') {
      character.points.abilities = value;
    }
    renderBuilder();
  }

  function adjustAttribute(id, delta) {
    const attr = currentTheme.attributes.find(a => a.id === id);
    const min = attr ? (attr.min || 0) : 0;
    const max = attr ? (attr.max || 10) : 10;
    const newVal = character.attributes[id] + delta;
    
    if (newVal < min || newVal > max) return;
    if (delta > 0 && getRemainingPoints('attributes') <= 0) return;
    
    character.attributes[id] = newVal;
    renderBuilder();
  }

  function adjustSkill(category, id, delta) {
    const cat = currentTheme.skills[category];
    const maxSkill = cat ? (cat.max || 5) : 5;
    const newVal = character.skills[category][id] + delta;
    
    if (newVal < 0 || newVal > maxSkill) return;
    if (delta > 0 && getRemainingPoints('skills', category) <= 0) return;
    
    character.skills[category][id] = newVal;
    renderBuilder();
  }

  function toggleAbility(id) {
    const ability = currentTheme.abilities.find(a => a.id === id);
    const cost = ability ? (ability.cost || 1) : 1;
    const currentLevel = character.abilities[id] || 0;
    
    if (currentLevel === 0) {
      // Turning on - check if can afford
      if (getRemainingPoints('abilities') < cost) {
        return;
      }
      character.abilities[id] = 1;
    } else {
      // Turning off
      character.abilities[id] = 0;
    }
    renderBuilder();
  }

  function adjustAbilityLevel(id, delta) {
    const ability = currentTheme.abilities.find(a => a.id === id);
    if (!ability || !ability.levelable) return;
    
    const cost = ability.cost || 1;
    const maxLevel = ability.maxLevel || 1;
    const currentLevel = character.abilities[id] || 0;
    const newLevel = currentLevel + delta;
    
    if (newLevel < 0 || newLevel > maxLevel) return;
    if (delta > 0 && getRemainingPoints('abilities') < cost) return;
    
    character.abilities[id] = newLevel;
    renderBuilder();
  }

  // Custom skills/abilities
  function addCustomSkill(category) {
    character.custom.skills[category].push({ label: '', value: 0, description: '', editing: true });
    renderBuilder();
  }

  function saveCustomSkill(category, index) {
    const skill = character.custom.skills[category][index];
    if (!skill.label || skill.label.trim() === '') {
      skill.label = 'Custom Skill';
    }
    skill.editing = false;
    renderBuilder();
  }

  function editCustomSkill(category, index) {
    character.custom.skills[category][index].editing = true;
    renderBuilder();
  }

  function adjustCustomSkill(category, index, delta) {
    const cat = currentTheme.skills[category];
    const maxSkill = cat ? (cat.max || 5) : 5;
    const skill = character.custom.skills[category][index];
    const newVal = skill.value + delta;
    
    if (newVal < 0 || newVal > maxSkill) return;
    if (delta > 0 && getRemainingPoints('skills', category) <= 0) return;
    
    skill.value = newVal;
    renderBuilder();
  }

  function updateCustomSkill(category, index, field, value) {
    character.custom.skills[category][index][field] = value;
  }

  function removeCustomSkill(category, index) {
    character.custom.skills[category].splice(index, 1);
    renderBuilder();
  }

  function addCustomAbility() {
    character.custom.abilities.push({ label: '', description: '', cost: 1, levelable: false, level: 1, editing: true });
    renderBuilder();
  }

  function saveCustomAbility(index) {
    const ability = character.custom.abilities[index];
    if (!ability.label || ability.label.trim() === '') {
      ability.label = 'Custom Ability';
    }
    ability.editing = false;
    renderBuilder();
  }

  function editCustomAbility(index) {
    character.custom.abilities[index].editing = true;
    renderBuilder();
  }

  function updateCustomAbility(index, field, value) {
    character.custom.abilities[index][field] = value;
    if (field === 'levelable' && value === true) {
      // Initialize level when making levelable
      character.custom.abilities[index].level = character.custom.abilities[index].level || 1;
    }
    renderBuilder();
  }

  function adjustCustomAbilityLevel(index, delta) {
    const ca = character.custom.abilities[index];
    if (!ca || !ca.levelable) return;
    
    const cost = ca.cost || 1;
    const currentLevel = ca.level || 1;
    const newLevel = currentLevel + delta;
    
    if (newLevel < 1) return;
    if (delta > 0 && getRemainingPoints('abilities') < cost) return;
    
    ca.level = newLevel;
    renderBuilder();
  }

  function removeCustomAbility(index) {
    character.custom.abilities.splice(index, 1);
    renderBuilder();
  }

  // Import/Export
  function exportCharacter() {
    const data = JSON.stringify(character, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (character.name || 'character') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyToClipboard() {
    const data = JSON.stringify(character, null, 2);
    navigator.clipboard.writeText(data).then(() => {
      // Brief visual feedback
      const btn = document.getElementById('copy-btn');
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  }

  function openPasteModal() {
    document.getElementById('paste-input').value = '';
    document.getElementById('paste-error').textContent = '';
    pasteModal.classList.add('open');
    document.getElementById('paste-input').focus();
  }

  function closePasteModal() {
    pasteModal.classList.remove('open');
  }

  function confirmPaste() {
    const input = document.getElementById('paste-input').value.trim();
    const errorEl = document.getElementById('paste-error');
    
    if (!input) {
      errorEl.textContent = 'Please paste JSON data.';
      return;
    }
    
    let data;
    try {
      data = JSON.parse(input);
    } catch (err) {
      errorEl.textContent = 'Invalid JSON format. Please check your input.';
      return;
    }
    
    // Validate structure - check for expected fields
    if (typeof data !== 'object' || data === null) {
      errorEl.textContent = 'Invalid format: Expected a character object.';
      return;
    }
    
    // Check for at least some expected character fields
    const hasValidFields = data.hasOwnProperty('attributes') || 
                           data.hasOwnProperty('skills') || 
                           data.hasOwnProperty('abilities') ||
                           data.hasOwnProperty('name') ||
                           data.hasOwnProperty('health');
    
    if (!hasValidFields) {
      errorEl.textContent = 'Invalid format: Missing character data fields.';
      return;
    }
    
    // Valid - load the character
    try {
      character = mergeCharacter(data);
      closePasteModal();
      renderSheet();
      if (builderMode) renderBuilder();
    } catch (err) {
      errorEl.textContent = 'Error loading character: ' + err.message;
    }
  }

  function importCharacter(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        character = mergeCharacter(data);
        renderSheet();
        if (builderMode) renderBuilder();
      } catch (err) {
        alert('Invalid file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function mergeCharacter(data) {
    const base = createEmptyCharacter(currentTheme);
    
    base.name = data.name || '';
    base.health = data.health || base.health;
    
    if (data.points) {
      base.points = data.points;
    }
    
    if (data.attributes) {
      Object.keys(data.attributes).forEach(key => {
        if (base.attributes.hasOwnProperty(key)) {
          base.attributes[key] = data.attributes[key];
        }
      });
    }
    
    if (data.skills) {
      Object.keys(data.skills).forEach(cat => {
        if (base.skills[cat]) {
          Object.keys(data.skills[cat]).forEach(skill => {
            if (base.skills[cat].hasOwnProperty(skill)) {
              base.skills[cat][skill] = data.skills[cat][skill];
            }
          });
        }
      });
    }
    
    if (data.abilities) {
      Object.keys(data.abilities).forEach(key => {
        if (base.abilities.hasOwnProperty(key)) {
          // Handle both old boolean format and new level format
          const val = data.abilities[key];
          if (typeof val === 'boolean') {
            base.abilities[key] = val ? 1 : 0;
          } else {
            base.abilities[key] = val;
          }
        }
      });
    }
    
    if (data.custom) {
      // Ensure imported custom items are in view mode (editing: false)
      if (data.custom.skills) {
        Object.keys(data.custom.skills).forEach(cat => {
          if (data.custom.skills[cat]) {
            data.custom.skills[cat] = data.custom.skills[cat].map(s => ({ ...s, editing: false }));
          }
        });
      }
      if (data.custom.abilities) {
        data.custom.abilities = data.custom.abilities.map(a => ({ ...a, editing: false }));
      }
      base.custom = data.custom;
    }
    
    return base;
  }

  // Expose public API
  window.CharacterBuilder = {
    init,
    loadTheme,
    setHealth,
    addHealth,
    resetHealth,
    setName,
    setMaxHealth,
    setMaxPoints,
    adjustAttribute,
    adjustSkill,
    toggleAbility,
    adjustAbilityLevel,
    addCustomSkill,
    adjustCustomSkill,
    updateCustomSkill,
    removeCustomSkill,
    saveCustomSkill,
    editCustomSkill,
    addCustomAbility,
    updateCustomAbility,
    adjustCustomAbilityLevel,
    removeCustomAbility,
    saveCustomAbility,
    editCustomAbility
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
