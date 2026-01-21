const API_BASE_URL = 'https://api-sfile-tools.vercel.app/';

let currentTab = 'file-search';
let currentPage = 1;
let currentQuery = '';
let currentSource = 'sfile';
let totalPages = 1;
let currentCookies = '';
let searchResultsState = null;
let scrollPosition = 0;

function handleSearch() {
    const searchInput = document.getElementById('file-search-input');
    const query = searchInput.value.trim();
    const sourceRadios = document.querySelectorAll('input[name="search-source"]');
    
    sourceRadios.forEach(radio => {
        if (radio.checked) {
            currentSource = radio.value;
        }
    });
    
    if (query) {
        currentQuery = query;
        currentPage = 1;
        searchFiles(query, currentPage, currentSource);
    } else {
        showError('Please enter a search query!');
    }
}

function handleDownload() {
    const downloadInput = document.getElementById('download-input');
    const url = downloadInput.value.trim();
    
    if (url) {
        const sfileRegex = /^https:\/\/sfile\.co\/[a-zA-Z0-9]+\/?$/;
        const simfileRegex = /^https:\/\/simfile\.co\/[a-zA-Z0-9]+\/?$/;
        
        if (!sfileRegex.test(url) && !simfileRegex.test(url)) {
            showDownloadError('Invalid URL! Please enter a valid Sfile.co or Simfile.co URL.');
            return;
        }
        getDownloadLink(url);
    } else {
        showDownloadError('Please enter a Sfile or Simfile URL!');
    }
}

function clearAll() {
    const searchInput = document.getElementById('file-search-input');
    const clearBtn = document.getElementById('clear-search');
    const errorMessage = document.getElementById('error-message');
    const searchResults = document.getElementById('search-results');
    const fileContainer = document.getElementById('file-container');
    const pagination = document.getElementById('pagination');
    
    searchInput.value = '';
    clearBtn.style.display = 'none';
    errorMessage.classList.remove('active');
    searchResults.classList.remove('active');
    fileContainer.style.display = 'none';
    pagination.style.display = 'none';
    currentQuery = '';
    currentPage = 1;
    currentCookies = '';
    searchResultsState = null;
    scrollPosition = 0;
    searchInput.focus();
}

function clearDownloadInput() {
    const downloadInput = document.getElementById('download-input');
    const clearBtn = document.getElementById('clear-download');
    const errorMessage = document.getElementById('download-error-message');
    const resultContainer = document.getElementById('download-result-container');
    
    downloadInput.value = '';
    clearBtn.style.display = 'none';
    errorMessage.classList.remove('active');
    resultContainer.style.display = 'none';
    currentCookies = '';
    downloadInput.focus();
}

function searchFiles(query, page, source) {
    const loader = document.getElementById('loader');
    const loaderText = loader.querySelector('p');
    const errorMessage = document.getElementById('error-message');
    const searchResults = document.getElementById('search-results');
    const fileContainer = document.getElementById('file-container');
    const pagination = document.getElementById('pagination');
    
    loaderText.textContent = 'Searching for "' + query + '" on ' + (source === 'sfile' ? 'Sfile.co' : 'Simfile.co') + '...';
    loader.classList.add('active');
    errorMessage.classList.remove('active');
    searchResults.classList.remove('active');
    fileContainer.style.display = 'none';
    pagination.style.display = 'none';
    
    const xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE_URL + 'api/search?query=' + encodeURIComponent(query) + '&page=' + page + '&source=' + source, true);
    
    xhr.onload = function() {
        loader.classList.remove('active');
        
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const data = JSON.parse(xhr.responseText);
                
                if (data.success && data.data && data.data.length > 0) {
                    totalPages = data.pageCount;
                    searchResultsState = {
                        data: data.data,
                        query: query,
                        totalResults: data.totalResults,
                        currentPage: data.currentPage,
                        pageCount: data.pageCount
                    };
                    displaySearchResults(data.data, query, data.totalResults);
                    updatePagination(data.currentPage, data.pageCount);
                } else {
                    showError('No files found matching "' + query + '"');
                }
            } catch (e) {
                showError('Failed to parse response data!');
            }
        } else {
            showError('Failed to search. Please try again.');
        }
    };
    
    xhr.onerror = function() {
        loader.classList.remove('active');
        showError('Network error occurred. Please check your connection.');
    };
    
    xhr.send();
}

function displaySearchResults(results, query, totalResults) {
    const searchResults = document.getElementById('search-results');
    searchResults.innerHTML = '';
    
    const header = document.createElement('div');
    header.className = 'results-header';
    header.innerHTML = 'Found <strong>' + totalResults.toLocaleString() + '</strong> result(s) for "<strong>' + query + '</strong>". Click to download:';
    searchResults.appendChild(header);
    
    const resultsList = document.createElement('div');
    resultsList.className = 'results-list';
    
    results.forEach(function(file) {
        const item = document.createElement('div');
        item.className = 'result-item';
        
        let fileUrl = file.url;
        if (file.url.includes('sfile.co')) {
            fileUrl = file.url.replace(/^https?:\/\/sfile\.co/, '');
            item.setAttribute('data-url', 'https://sfile.co' + fileUrl);
        } else {
            item.setAttribute('data-url', file.url);
        }
        
        if (file.icon) {
            if (file.icon.startsWith('<div')) {
                const iconWrapper = document.createElement('div');
                iconWrapper.className = 'result-item-icon';
                iconWrapper.innerHTML = file.icon;
                item.appendChild(iconWrapper);
            } else {
                const icon = document.createElement('img');
                icon.className = 'result-item-icon';
                icon.src = file.icon;
                icon.alt = 'File icon';
                item.appendChild(icon);
            }
        }
        
        const name = document.createElement('div');
        name.className = 'result-item-name';
        name.textContent = file.name;
        item.appendChild(name);
        
        const info = document.createElement('div');
        info.className = 'result-item-info';
        
        let infoHTML = '<div class="result-item-size">' + file.size + '</div>';
        if (file.date) {
            infoHTML += '<div class="result-item-date">' + file.date + '</div>';
        }
        if (file.downloads) {
            infoHTML += '<div class="result-item-downloads">Downloads: ' + file.downloads + '</div>';
        }
        
        info.innerHTML = infoHTML;
        item.appendChild(info);
        
        item.addEventListener('click', function() {
            if (!item.classList.contains('loading')) {
                scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
                
                item.classList.add('loading');
                
                const loader = document.getElementById('loader');
                const loaderText = loader.querySelector('p');
                loaderText.textContent = 'Getting download link...';
                loader.classList.add('active');
                
                const url = item.getAttribute('data-url');
                getDownloadLink(url, function() {
                    item.classList.remove('loading');
                    loader.classList.remove('active');
                });
            }
        });
        
        resultsList.appendChild(item);
    });
    
    searchResults.appendChild(resultsList);
    searchResults.classList.add('active');
}

function updatePagination(currentPage, totalPages) {
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');
    
    pageInfo.textContent = 'Page ' + currentPage + ' of ' + totalPages;
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    
    pagination.style.display = 'flex';
}

function getDownloadLink(url, callback) {
    const loader = document.getElementById('download-loader');
    const loaderText = loader.querySelector('p');
    const errorMessage = document.getElementById('download-error-message');
    const resultContainer = document.getElementById('download-result-container');
    const searchResults = document.getElementById('search-results');
    const pagination = document.getElementById('pagination');
    
    loaderText.textContent = 'Getting download link...';
    loader.classList.add('active');
    errorMessage.classList.remove('active');
    resultContainer.style.display = 'none';
    
    if (currentTab === 'file-search') {
        searchResults.classList.remove('active');
        pagination.style.display = 'none';
    }
    
    const xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE_URL + 'api/download?url=' + encodeURIComponent(url), true);
    
    xhr.onload = function() {
        loader.classList.remove('active');
        if (callback) callback();
        
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const data = JSON.parse(xhr.responseText);
                
                if (data.success && data.data) {
                    if (data.cookies) {
                        currentCookies = data.cookies;
                    }
                    displayDownloadInfo(data.data, url);
                } else {
                    if (currentTab === 'file-search') {
                        showError(data.message);
                    } else {
                        showDownloadError(data.message);
                    }
                }
            } catch (e) {
                if (currentTab === 'file-search') {
                    showError('Failed to parse response data!');
                } else {
                    showDownloadError('Failed to parse response data!');
                }
            }
        } else {
            if (currentTab === 'file-search') {
                showError('Failed to get download link. Please try again.');
            } else {
                showDownloadError('Failed to get download link. Please try again.');
            }
        }
    };
    
    xhr.onerror = function() {
        loader.classList.remove('active');
        if (callback) callback();
        if (currentTab === 'file-search') {
            showError('Network error occurred. Please check your connection.');
        } else {
            showDownloadError('Network error occurred. Please check your connection.');
        }
    };
    
    xhr.send();
}

function backToResults() {
    if (searchResultsState) {
        const fileContainer = document.getElementById('file-container');
        const searchResults = document.getElementById('search-results');
        const pagination = document.getElementById('pagination');
        
        fileContainer.style.display = 'none';
        searchResults.classList.add('active');
        pagination.style.display = 'flex';
        
        setTimeout(function() {
            window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
        }, 100);
    }
}

function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(function() {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Copied!';
        button.classList.add('copied');
        
        setTimeout(function() {
            button.innerHTML = originalHTML;
            button.classList.remove('copied');
        }, 2000);
    }).catch(function() {
        alert('Failed to copy to clipboard');
    });
}

function displayDownloadInfo(data, sourceUrl) {
    const containerSelector = currentTab === 'file-search' ? 'file-container' : 'download-result-container';
    const nameSelector = currentTab === 'file-search' ? 'file-name' : 'download-file-name';
    const specsSelector = currentTab === 'file-search' ? 'file-specs' : 'download-specs';
    
    const container = document.getElementById(containerSelector);
    const fileName = document.getElementById(nameSelector);
    const specsContainer = document.getElementById(specsSelector);
    
    fileName.textContent = data.name;
    
    specsContainer.innerHTML = '';
    
    const specs = [
        { label: 'File Name', value: data.name, icon: 'fa-solid fa-file' },
        { label: 'File Size', value: data.size, icon: 'fa-solid fa-database' },
        { label: 'File Type', value: data.mimeType, icon: 'fa-solid fa-file-code' },
        { label: 'Uploaded', value: data.uploaded, icon: 'fa-solid fa-calendar-days' },
        { label: 'Downloads', value: data.downloads, icon: 'fa-solid fa-download' }
    ];
    
    specs.forEach(function(spec) {
        if (spec.value) {
            const li = document.createElement('li');
            li.className = 'file-spec-item';
            li.innerHTML = '<div class="file-spec-icon"><i class="' + spec.icon + '"></i></div>' +
                           '<div class="file-spec-content">' +
                           '<div class="file-spec-text">' +
                           '<span class="file-spec-value">' + spec.value + '</span>' +
                           '<span class="file-spec-label">' + spec.label + '</span>' +
                           '</div>' +
                           '</div>';
            specsContainer.appendChild(li);
        }
    });
    
    const urlLi = document.createElement('li');
    urlLi.className = 'file-spec-item';
    urlLi.innerHTML = '<div class="file-spec-icon"><i class="fa-solid fa-link"></i></div>' +
                      '<div class="file-spec-content">' +
                      '<div class="file-spec-text">' +
                      '<span class="file-spec-value">' + sourceUrl + '</span>' +
                      '<span class="file-spec-label">Source URL</span>' +
                      '</div>' +
                      '<button class="copy-btn" onclick="copyToClipboard(\'' + sourceUrl + '\', this)">' +
                      '<i class="fas fa-copy"></i> Copy' +
                      '</button>' +
                      '</div>';
    specsContainer.appendChild(urlLi);
    
    if (currentCookies && sourceUrl.includes('simfile.co')) {
        const downloadBtn = document.createElement('a');
        downloadBtn.href = API_BASE_URL + 'api/get-download?url=' + encodeURIComponent(data.downloadUrl) + '&cookies=' + encodeURIComponent(currentCookies);
        downloadBtn.className = 'download-button';
        downloadBtn.download = data.name;
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download File';
        specsContainer.appendChild(downloadBtn);
    } else if (sourceUrl.includes('sfile.co')) {
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-button';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download File';
        downloadBtn.onclick = function() {
            window.location.href = data.downloadUrl;
        };
        specsContainer.appendChild(downloadBtn);
    } else {
        const downloadBtn = document.createElement('a');
        downloadBtn.href = data.downloadUrl;
        downloadBtn.className = 'download-button';
        downloadBtn.target = '_blank';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download File';
        specsContainer.appendChild(downloadBtn);
    }
    
    if (currentTab === 'file-search' && searchResultsState) {
        const backButton = document.createElement('button');
        backButton.className = 'download-button';
        backButton.style.background = 'linear-gradient(135deg, #6b7280, #4b5563)';
        backButton.style.marginTop = '20px';
        backButton.innerHTML = '<i class="fas fa-arrow-left"></i> Back to Results';
        backButton.onclick = backToResults;
        specsContainer.appendChild(backButton);
    }
    
    container.style.display = 'block';
    window.scrollTo({ top: container.offsetTop - 20, behavior: 'smooth' });
}

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    
    errorText.textContent = message;
    errorMessage.classList.add('active');
}

function showDownloadError(message) {
    const errorMessage = document.getElementById('download-error-message');
    const errorText = document.getElementById('download-error-text');
    
    errorText.textContent = message;
    errorMessage.classList.add('active');
}

function switchTab(tabName) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(function(btn) {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        }
    });
    
    tabContents.forEach(function(content) {
        content.classList.remove('active');
        if (content.id === tabName) {
            content.classList.add('active');
        }
    });
    
    currentTab = tabName;
    
    if (tabName === 'file-search') {
        clearAll();
    } else if (tabName === 'file-download') {
        clearDownloadInput();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('year').textContent = new Date().getFullYear();
    
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('file-search-input');
    const clearBtn = document.getElementById('clear-search');
    const downloadBtn = document.getElementById('download-btn');
    const downloadInput = document.getElementById('download-input');
    const clearDownloadBtn = document.getElementById('clear-download');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navMenu = document.getElementById('nav-menu');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    searchBtn.addEventListener('click', handleSearch);
    clearBtn.addEventListener('click', clearAll);
    downloadBtn.addEventListener('click', handleDownload);
    clearDownloadBtn.addEventListener('click', clearDownloadInput);
    
    prevBtn.addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            searchFiles(currentQuery, currentPage, currentSource);
        }
    });
    
    nextBtn.addEventListener('click', function() {
        if (currentPage < totalPages) {
            currentPage++;
            searchFiles(currentQuery, currentPage, currentSource);
        }
    });
    
    tabButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    hamburgerMenu.addEventListener('click', function() {
        navMenu.classList.toggle('show');
    });
    
    document.addEventListener('click', function(event) {
        if (!hamburgerMenu.contains(event.target) && !navMenu.contains(event.target)) {
            navMenu.classList.remove('show');
        }
    });
    
    searchInput.addEventListener('input', function() {
        if (searchInput.value.trim()) {
            clearBtn.style.display = 'flex';
        } else {
            clearBtn.style.display = 'none';
        }
    });
    
    downloadInput.addEventListener('input', function() {
        if (downloadInput.value.trim()) {
            clearDownloadBtn.style.display = 'flex';
        } else {
            clearDownloadBtn.style.display = 'none';
        }
    });
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    downloadInput.addEventListener('keypress', function(e) {
    
        if (e.key === 'Enter') {
            handleDownload();
        }
    });
});
