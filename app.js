document.addEventListener('DOMContentLoaded', function() {
    const uploadBox = document.getElementById('uploadBox');
    const fileInput = document.getElementById('fileInput');
    const fileName = document.getElementById('fileName');
    const estimateBtn = document.getElementById('estimateBtn');
    const uploadSection = document.getElementById('uploadSection');
    const loadingSection = document.getElementById('loadingSection');
    const resultsSection = document.getElementById('resultsSection');
    const newEstimateBtn = document.getElementById('newEstimateBtn');

    let selectedFile = null;

    // Click to upload
    uploadBox.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Drag and drop
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('drag-over');
    });

    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('drag-over');
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    function handleFile(file) {
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file');
            return;
        }
        selectedFile = file;
        fileName.textContent = file.name;
        uploadBox.classList.add('has-file');
        estimateBtn.disabled = false;
    }

    // Generate estimate
    estimateBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        uploadSection.style.display = 'none';
        loadingSection.style.display = 'block';

        try {
            const base64 = await fileToBase64(selectedFile);
            const response = await fetch('/api/estimate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ pdf: base64 }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate estimate');
            }

            const data = await response.json();
            displayResults(data);
        } catch (error) {
            console.error('Error:', error);
            alert('Error generating estimate. Please try again.');
            resetForm();
        }
    });

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }

    function displayResults(data) {
        loadingSection.style.display = 'none';
        resultsSection.style.display = 'block';

        document.getElementById('propertyAddress').textContent = data.address;

        document.getElementById('dataSummary').innerHTML = `
            <strong>Total Area:</strong> ${data.totalArea.toLocaleString()} sq ft<br>
            <strong>Base Squares:</strong> ${data.baseSquares}<br>
            <strong>Waste:</strong> ${data.wastePercent}% (${data.wasteSource})<br>
            <strong>Squares + Waste:</strong> ${data.squaresWithWaste}
        `;

        document.getElementById('pitchBreakdown').innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Pitch Bucket</th>
                        <th>Percentage</th>
                        <th>Rounded Squares</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Mod Bit (0-2/12)</td>
                        <td>${data.pitchBreakdown.modBit.percent}%</td>
                        <td>${data.pitchBreakdown.modBit.squares} sq</td>
                    </tr>
                    <tr>
                        <td>3/12 Full I&W</td>
                        <td>${data.pitchBreakdown.threetwelve.percent}%</td>
                        <td>${data.pitchBreakdown.threetwelve.squares} sq</td>
                    </tr>
                    <tr>
                        <td>4/12 & Up</td>
                        <td>${data.pitchBreakdown.fourplus.percent}%</td>
                        <td>${data.pitchBreakdown.fourplus.squares} sq</td>
                    </tr>
                </tbody>
            </table>
        `;

        // HDZ prices
        document.getElementById('hdzSystemsPlus').textContent = formatCurrency(data.pricing.hdz.systemsPlus);
        document.getElementById('hdzSilver').textContent = formatCurrency(data.pricing.hdz.silver);
        document.getElementById('hdzGold').textContent = formatCurrency(data.pricing.hdz.gold);

        // UHDZ prices
        document.getElementById('uhdzSystemsPlus').textContent = formatCurrency(data.pricing.uhdz.systemsPlus);
        document.getElementById('uhdzSilver').textContent = formatCurrency(data.pricing.uhdz.silver);
        document.getElementById('uhdzGold').textContent = formatCurrency(data.pricing.uhdz.gold);

        // Flags
        const flagsSection = document.getElementById('flagsSection');
        if (data.flags && data.flags.length > 0) {
            flagsSection.innerHTML = '<strong>⚠️ Flags:</strong> ' + data.flags.join(', ');
        } else {
            flagsSection.innerHTML = '';
        }
    }

    function formatCurrency(amount) {
        return '$' + Math.round(amount).toLocaleString();
    }

    function resetForm() {
        selectedFile = null;
        fileInput.value = '';
        fileName.textContent = '';
        uploadBox.classList.remove('has-file');
        estimateBtn.disabled = true;
        uploadSection.style.display = 'block';
        loadingSection.style.display = 'none';
        resultsSection.style.display = 'none';
    }

    newEstimateBtn.addEventListener('click', resetForm);
});
