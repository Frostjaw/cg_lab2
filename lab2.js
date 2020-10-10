let sourceImage;
let sourceCanvas = document.getElementById("sourceCanvas");
let resultCanvas = document.getElementById("resultCanvas");

const defaultTransparency = 255
const imageSize = 500

window.onload = function() {
	let image = new Image();
	image.crossOrigin = "Anonymous";
	image.src = 'https://i.imgur.com/iMasKVY.png';

	image.onload = function(){
		let canvas = sourceCanvas.getContext("2d")
		canvas.drawImage(image, 0, 0);		
		sourceImage = sourceCanvas.getContext("2d").getImageData(0, 0, imageSize, imageSize);
	};
}

let initializeDot = function(x, y){
  this.x = x;
  this.y = y;
}

initializeDot.prototype = {
	draw: function (canvas) {
		canvas.beginPath();
		canvas.arc(this.x, this.y, 3, 0, 2 * Math.PI);
		canvas.fill();
		canvas.strokeStyle = 'red';
		canvas.stroke();
	}
}

let sourceImageListener = function(e) {
	getCursorPosition(sourceCanvas, e)
}

sourceCanvas.addEventListener('click', sourceImageListener);

let resultImageListener = function(e) {
	getCursorPosition(resultCanvas, e)
}

resultCanvas.addEventListener('click', resultImageListener);

let dots = [];

function getCursorPosition(canvas, event) {
	let canvasContext = canvas.getContext("2d");	
	let rect = canvas.getBoundingClientRect()
	let x = event.clientX - rect.left
	let y = event.clientY - rect.top
	
	// push and draw dot
	dots.push(new initializeDot(x, y));	
	dots[dots.length - 1].draw(canvasContext);
	
	// source image
	if (dots.length == 3) {
		// remove listener
		sourceCanvas.removeEventListener('click', sourceImageListener);

		// draw lines
		canvasContext.beginPath();

		for (let i = 0; i <= 3; i++) { 
			canvasContext.moveTo(dots[i % 3].x, dots[i % 3].y);
			canvasContext.lineTo(dots[(i + 1) % 3].x, dots[(i + 1) % 3].y);
			canvasContext.stroke();
		}
	}
	
	// result image
	if (dots.length == 6) {
		// remove listener
		resultCanvas.removeEventListener('click', resultImageListener);

		// draw lines
		canvasContext.beginPath();

		for (let i = 3; i <= 6; i++) {
			canvasContext.moveTo(dots[i % 3 + 3].x, dots[i % 3 + 3].y);
			canvasContext.lineTo(dots[(i + 1) % 3 + 3].x, dots[(i + 1) % 3 + 3].y);
			canvasContext.stroke();
		}		

		let coeffMatrix = calculateCoeffMatrix(dots)
		let ratio = calculateRatio(dots)
		drawResultImage(coeffMatrix, canvas, ratio);
	}

}

function calculateRatio(dots){
	let sourceDistances = [
		math.distance([dots[0].x,dots[0].y], [dots[1].x,dots[1].y]),
		math.distance([dots[1].x,dots[1].y], [dots[2].x,dots[2].y]),
		math.distance([dots[2].x,dots[2].y], [dots[0].x,dots[0].y])
	]

	let resultDistances = [
		math.distance([dots[3].x,dots[3].y], [dots[4].x,dots[4].y]),
		math.distance([dots[4].x,dots[4].y], [dots[5].x,dots[5].y]),
		math.distance([dots[5].x,dots[5].y], [dots[3].x,dots[3].y])
	]

	let sourcePerimeter = sourceDistances[0] + sourceDistances[1] + sourceDistances[2];
	let resultPerimeter = resultDistances[0] + resultDistances[1] + resultDistances[2];
	let sourceArea = math.sqrt(sourcePerimeter * (sourcePerimeter - sourceDistances[0]) * (sourcePerimeter - sourceDistances[1]) * (sourcePerimeter - sourceDistances[2]));
	let resultArea = math.sqrt(resultPerimeter * (resultPerimeter - resultDistances[0]) * (resultPerimeter - resultDistances[1]) * (resultPerimeter - resultDistances[2]));
	
	return resultArea / sourceArea
}

function calculateCoeffMatrix(dots){
	// lusolve solves the linear system A * x = b where A is an [n x n] matrix and b is a [n] column vector.
	let A = [
		[dots[0].x, dots[0].y, 1, 0, 0, 0],
		[0, 0, 0, dots[0].x, dots[0].y, 1],
		[dots[1].x, dots[1].y, 1, 0, 0, 0],
		[0, 0, 0, dots[1].x, dots[1].y, 1],
		[dots[2].x, dots[2].y, 1, 0, 0, 0],
		[0, 0, 0, dots[2].x, dots[2].y, 1]
	]
	let x = [dots[3].x, dots[3].y, dots[4].x, dots[4].y, dots[5].x, dots[5].y]		
	let b = math.lusolve(A, x);

	// transpose and add last row
	let coeffMatrix = [];
	for (let i = 0; i < 3; i++) coeffMatrix[i] = [];

	coeffMatrix[0][0] = b[0][0];
	coeffMatrix[0][1] = b[1][0];
	coeffMatrix[0][2] = b[2][0];
	coeffMatrix[1][0] = b[3][0];
	coeffMatrix[1][1] = b[4][0];
	coeffMatrix[1][2] = b[5][0];
	coeffMatrix[2][0] = 0;
	coeffMatrix[2][1] = 0;
	coeffMatrix[2][2] = 1;

	return coeffMatrix
}

function drawResultImage(coeffMatrix, canvas, ratio){
	// inverse  matrix
	let inverseMatrix = math.inv(coeffMatrix);

	let canvasContext = canvas.getContext("2d");
	let resultImageData = canvasContext.createImageData(1000, 1000);
	let sourceData = sourceImage.data;
	
	// check ratio
	if (ratio > 1) bilinearFiltration(inverseMatrix, resultImageData, sourceData)
	else trilinearFiltration(canvasContext, inverseMatrix, resultImageData, sourceData)
	
	canvasContext.putImageData(resultImageData, 0, 0);
}

function bilinearFiltration(inverseMatrix, resultImageData, sourceData){
	let resultData = resultImageData.data

	for (let i = 0; i < imageSize; i++) {
		for (let j = 0; j < imageSize; j++) {
			let resultX = j * inverseMatrix[0][0] + i * inverseMatrix[0][1] + inverseMatrix[0][2];
			let resultY = j * inverseMatrix[1][0] + i * inverseMatrix[1][1] + inverseMatrix[1][2];

			// fix black dots
			let tempIndex = (Math.round(resultY) * sourceImage.width + Math.round(resultX)) * 4;
			
			// bilinear interpolation
			let rgbaArray = []
			for (let k = 0; k < 3; k++) {
				rgbaArray[k] = (
					sourceData[(Math.floor(resultY) * sourceImage.width + Math.floor(resultX)) * 4 + k] * (Math.ceil(resultX) - resultX) 
					+
					sourceData[(Math.floor(resultY) * sourceImage.width + Math.ceil(resultX)) * 4 + k] * (resultX - Math.floor(resultX))
				) * (Math.ceil(resultY) - resultY)
				+
				(
					sourceData[(Math.ceil(resultY) * sourceImage.width + Math.floor(resultX)) * 4 + k] * (Math.ceil(resultX) - resultX) 
					+
					sourceData[(Math.ceil(resultY) * sourceImage.width + Math.ceil(resultX)) * 4 + k] * (resultX - Math.floor(resultX))
				) * (resultY - Math.floor(resultY));

				if (rgbaArray[k] == 0) rgbaArray[k] = sourceData[tempIndex + k]				
			}			

			// transparency
			let curTransparency = defaultTransparency
			if (resultX > imageSize || resultX < 0) curTransparency = 0;
			
			// fill result data
			let resultIndex = (i * resultImageData.width + j) * 4;
			resultData[resultIndex] = rgbaArray[0]; // r
			resultData[resultIndex + 1] = rgbaArray[1]; // g
			resultData[resultIndex + 2] = rgbaArray[2]; // b
			resultData[resultIndex + 3] = curTransparency; // a			
		}
	}
}

function trilinearFiltration(canvasContext, inverseMatrix, resultImageData, sourceData){
	let resultData = resultImageData.data

	// small copies
	let smallImages = [];

	for (let k = 0; k < 5; k++) {
		let smallImageData = canvasContext.createImageData(Math.floor(sourceImage.width / math.pow(2, k)), Math.floor(sourceImage.height / math.pow(2, k)));
		smallImages[k] = smallImageData

		for (let i = 0; i < smallImages[k].width; i++) {
			for (let j = 0; j < smallImages[k].height; j++) {
				let rgbArray = [];
				for (let t = 0; t < 4; t++) rgbArray[t] = 0;
				
				for (let m = 0; m < math.pow(2, k + 1); m++) {					
					let index = (
						(i * math.pow(2, k) + Math.floor(m / math.pow(2, k))) * sourceImage.width 
						+
						j * math.pow(2, k) + (m % math.pow(2, k))
						) * 4;

					rgbArray[0] += sourceData[index + 0];
					rgbArray[1] += sourceData[index + 1];
					rgbArray[2] += sourceData[index + 2];
					rgbArray[3] += sourceData[index + 3];
				}
				
				let resultIndex = (i * smallImages[k].width + j) * 4;

				smallImages[k].data[resultIndex] = rgbArray[0] / math.pow(2, k + 1); // r
				smallImages[k].data[resultIndex + 1] = rgbArray[1] / math.pow(2, k + 1); // g
				smallImages[k].data[resultIndex + 2] = rgbArray[2] / math.pow(2, k + 1); // b
				smallImages[k].data[resultIndex + 3] = defaultTransparency; // a
			}
		}
	}
	
	// algorithm
	for (let i = 0; i < imageSize; i++) {
		for (let j = 0; j < imageSize; j++) {
			let resultX = j * inverseMatrix[0][0] + i * inverseMatrix[0][1] + inverseMatrix[0][2];
			let resultY = j * inverseMatrix[1][0] + i * inverseMatrix[1][1] + inverseMatrix[1][2];
			
			let previousX = (j - 1) * inverseMatrix[0][0] + (i - 1) * inverseMatrix[0][1] + inverseMatrix[0][2];
			let previousY = (j - 1) * inverseMatrix[1][0] + (i - 1) * inverseMatrix[1][1] + inverseMatrix[1][2];
			
			// calculate degree of raster reduction
			let k = math.sqrt((previousX - resultX) * (previousX - resultX) + (previousY - resultY) * (previousY - resultY));
			let indexK = (Math.floor(k / 2)) % 4;			
			let utilityK = math.pow(2, indexK);
			
			let kIndexTop = (
				Math.ceil(j * inverseMatrix[1][0] / utilityK + i * inverseMatrix[1][1] / utilityK + inverseMatrix[1][2] / utilityK) * smallImages[indexK].width 
				+ Math.ceil(j * inverseMatrix[0][0] / utilityK + i * inverseMatrix[0][1] / utilityK + inverseMatrix[0][2] / utilityK)
				) * 4;
			
			let kIndexBottom = (
				Math.ceil(j * inverseMatrix[1][0] / utilityK / 2 + i * inverseMatrix[1][1] / utilityK / 2 + inverseMatrix[1][2] / utilityK / 2) * smallImages[indexK + 1].width
				+ Math.ceil(j * inverseMatrix[0][0] / utilityK / 2 + i * inverseMatrix[0][1] / utilityK / 2 + inverseMatrix[0][2] / utilityK / 2)
				) * 4;			
			
			if (resultX > imageSize || resultX < 0) {
				kIndexTop = -10;
				kIndexBottom = -10;
			}
			
			// fill result data using linear interpolation
			let resultIndex = (i * resultImageData.width + j) * 4;
			resultData[resultIndex] = (smallImages[indexK].data[kIndexTop + 0] * (2 * utilityK - k) + smallImages[indexK + 1].data[kIndexBottom + 0] * (k - utilityK)) / utilityK; // r
			resultData[resultIndex + 1] = (smallImages[indexK].data[kIndexTop + 1] * (2 * utilityK - k) + smallImages[indexK + 1].data[kIndexBottom + 1] * (k - utilityK)) / utilityK; // g
			resultData[resultIndex + 2] = (smallImages[indexK].data[kIndexTop + 2] * (2 * utilityK - k) + smallImages[indexK + 1].data[kIndexBottom + 2] * (k - utilityK)) / utilityK; // b
			
			// transparency
			let curTransparency = defaultTransparency;

			// fix background
			if (resultData[resultIndex] == 0) curTransparency = 0;
			resultData[resultIndex + 3] = curTransparency; // a		
		}
	}
}