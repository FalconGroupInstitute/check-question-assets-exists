const fs = require('fs');
const path = require('path');

const imageFolderPath = path.join(__dirname, 'image_folder');
const imageNamesFile = path.join(__dirname, 'image_names.txt');

// Read the list of image names from the text file
fs.readFile(imageNamesFile, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading image names:', err);
    return;
  }

  const imageNames = data.trim().split('\n');

  // Check the existence of each image
  imageNames.forEach((imageName) => {
    const imagePath = path.join(imageFolderPath, imageName);

    fs.access(imagePath, fs.constants.F_OK, (err) => {
      if (err) {
        console.log(`Image ${imageName} does not exist.`);
      } else {
        console.log(`Image ${imageName} exists.`);
      }
    });
  });
});
