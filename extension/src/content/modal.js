/**
 * Country Blocker Modal Component
 * Provides UI for blocking/unblocking countries
 */

import { COUNTRY_FLAGS, COUNTRY_LIST, CSS_CLASSES } from '../shared/constants.js';
import { getFlagEmoji, formatCountryName, createElement } from '../shared/utils.js';

let currentModal = null;

/**
 * Show the country blocker modal
 * @param {Set} blockedCountries - Set of currently blocked countries
 * @param {Function} onAction - Callback for actions (toggle, clear)
 */
export function showModal(blockedCountries, onAction) {
    // Remove existing modal if present
    if (currentModal) {
        currentModal.remove();
        currentModal = null;
    }

    const overlay = createElement('div', {
        className: CSS_CLASSES.MODAL_OVERLAY
    });

    const modal = createElement('div', {
        className: CSS_CLASSES.MODAL
    });

    // Create header
    const header = createHeader(() => {
        overlay.remove();
        currentModal = null;
    });

    // Create body
    const { body, renderCountries, searchInput } = createBody(blockedCountries, onAction);

    // Create footer
    const footer = createFooter(blockedCountries, onAction, renderCountries, () => {
        overlay.remove();
        currentModal = null;
    });

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
            currentModal = null;
        }
    });

    // Close on Escape key
    const handleKeydown = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            currentModal = null;
            document.removeEventListener('keydown', handleKeydown);
        }
    };
    document.addEventListener('keydown', handleKeydown);

    // Add to page
    document.body.appendChild(overlay);
    currentModal = overlay;

    // Focus search input
    setTimeout(() => searchInput.focus(), 100);

    // Initial render
    renderCountries();
}

/**
 * Create modal header
 */
function createHeader(onClose) {
    const header = createElement('div', { className: 'x-blocker-header' });

    header.innerHTML = `
        <h2 class="x-blocker-title">
            <svg viewBox="0 0 24 24" width="24" height="24" style="display: inline-block; vertical-align: middle; margin-right: 8px;">
                <g><path fill="currentColor" d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm6 9.09c0 4-2.55 7.7-6 8.83-3.45-1.13-6-4.82-6-8.83V6.31l6-2.12 6 2.12v4.78zm-9-1.04l-1.41 1.41L10.5 14.5l6-6-1.41-1.41-4.59 4.58z"></path></g>
            </svg>
            Block Countries
        </h2>
        <button class="x-blocker-close" aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20">
                <g><path fill="currentColor" d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"></path></g>
            </svg>
        </button>
    `;

    header.querySelector('.x-blocker-close').addEventListener('click', onClose);

    return header;
}

/**
 * Create modal body with search and country list
 */
function createBody(blockedCountries, onAction) {
    const body = createElement('div', { className: 'x-blocker-body' });

    const info = createElement('div', {
        className: 'x-blocker-info',
        textContent: 'Select countries to block. Tweets from users in these countries will be hidden from your feed.'
    });

    const search = createElement('input', {
        type: 'text',
        className: 'x-blocker-search',
        placeholder: 'Search countries...'
    });

    const countriesContainer = createElement('div', {
        className: 'x-blocker-countries'
    });

    body.appendChild(info);
    body.appendChild(search);
    body.appendChild(countriesContainer);

    let currentFilter = '';

    // Render countries function
    const renderCountries = (filter = currentFilter) => {
        currentFilter = filter;
        countriesContainer.innerHTML = '';

        const filteredCountries = COUNTRY_LIST.filter(country =>
            country.includes(filter.toLowerCase())
        );

        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();

        for (const country of filteredCountries) {
            const item = createCountryItem(country, blockedCountries, onAction, renderCountries);
            fragment.appendChild(item);
        }

        countriesContainer.appendChild(fragment);
    };

    // Search functionality
    search.addEventListener('input', (e) => {
        renderCountries(e.target.value);
    });

    return { body, renderCountries, searchInput: search };
}

/**
 * Create a single country item
 */
function createCountryItem(country, blockedCountries, onAction, renderCountries) {
    const isBlocked = blockedCountries.has(country);
    
    const item = createElement('div', {
        className: `x-country-item${isBlocked ? ' blocked' : ''}`
    });

    // Flag
    const flagSpan = createElement('span', { className: 'x-country-flag' });
    const flag = getFlagEmoji(country);
    if (typeof flag === 'string' && flag.startsWith('<img')) {
        flagSpan.innerHTML = flag;
    } else {
        flagSpan.textContent = flag || '🌍';
    }

    // Name
    const name = createElement('span', {
        className: 'x-country-name',
        textContent: formatCountryName(country)
    });

    // Status
    const status = createElement('span', {
        className: 'x-country-status',
        textContent: isBlocked ? 'BLOCKED' : ''
    });

    item.appendChild(flagSpan);
    item.appendChild(name);
    item.appendChild(status);

    // Click handler
    item.addEventListener('click', async () => {
        const response = await onAction('toggle', country);
        
        if (response?.success) {
            // Update local state and re-render
            if (blockedCountries.has(country)) {
                blockedCountries.delete(country);
            } else {
                blockedCountries.add(country);
            }
            renderCountries();
            updateStats(blockedCountries.size);
        }
    });

    return item;
}

/**
 * Create modal footer
 */
function createFooter(blockedCountries, onAction, renderCountries, onClose) {
    const footer = createElement('div', { className: 'x-blocker-footer' });

    const stats = createElement('div', {
        className: 'x-blocker-stats',
        id: 'x-blocker-stats',
        textContent: `${blockedCountries.size} countries blocked`
    });

    const btnContainer = createElement('div', {
        style: { display: 'flex', gap: '12px' }
    });

    // Clear button
    const clearBtn = createElement('button', {
        className: 'x-blocker-btn x-blocker-btn-secondary',
        textContent: 'Clear All',
        onClick: async () => {
            const response = await onAction('clear');
            if (response?.success) {
                blockedCountries.clear();
                renderCountries();
                updateStats(0);
            }
        }
    });

    // Done button
    const doneBtn = createElement('button', {
        className: 'x-blocker-btn x-blocker-btn-primary',
        textContent: 'Done',
        onClick: onClose
    });

    btnContainer.appendChild(clearBtn);
    btnContainer.appendChild(doneBtn);
    footer.appendChild(stats);
    footer.appendChild(btnContainer);

    return footer;
}

/**
 * Update stats display
 */
function updateStats(count) {
    const stats = document.getElementById('x-blocker-stats');
    if (stats) {
        stats.textContent = `${count} countries blocked`;
    }
}

/**
 * Hide modal
 */
export function hideModal() {
    if (currentModal) {
        currentModal.remove();
        currentModal = null;
    }
}

/**
 * Check if modal is currently visible
 */
export function isModalVisible() {
    return currentModal !== null;
}