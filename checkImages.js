const fs = require('fs').promises;
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

// Configure AWS SDK v3 with your credentials and region
const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: 'AKIATBK6BGIEU2V4WJVZ',
        secretAccessKey: 'iYOt0nJyEURzp8+/eztTupqTcqyzxsjtf9wCvAND',
    },
});

// Initialize S3
const s3BucketName = 'jsonimages'; // Replace with your S3 bucket name

// Define the path to your JSON file
const jsonFilePath = path.join(__dirname, 'LMS-Test-Questions', 'cbse-6-12', 'questions.json');

// Define the path to your assets_old.json file
const assetsFilePath = path.join(__dirname, 'LMS-Test-Questions', 'cbse-6-12', 'assets.json');

// Function to create a text file with the given content
async function createTextFile(filename, content) {
  try {
    await fs.writeFile(filename, content);
    console.log(`File '${filename}' created successfully.`);
  } catch (error) {
    console.error(`Error creating file '${filename}':`, error);
  }
}

// Function to check if an image exists in S3
async function checkImageExists(imageName) {
  const params = {
    Bucket: s3BucketName,
    Key: imageName,
  };

  try {
    await s3Client.send(new HeadObjectCommand(params));
    return true; // Image exists in S3
  } catch (err) {
    if (err.name === 'NotFound') {
      return false; // Image does not exist in S3
    } else {
      throw err; // An error occurred while checking the image
    }
  }
}

// Function to fetch image name from assets data using ID
function getImageNameFromId(id, assetsData) {
  const asset = assetsData.find((asset) => asset._id.$oid === id);
  return asset ? asset.name : null;
}

// Function to check if a file exists in a folder or its subfolders
async function searchFileRecursive(folderPath, targetFileName) {
  const files = await fs.readdir(folderPath);

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stats = await fs.stat(filePath);

    if (stats.isDirectory()) {
      // If it's a directory, recursively search inside it
      const found = await searchFileRecursive(filePath, targetFileName);
      if (found) {
        return true;
      }
    } else if (file === targetFileName) {
      // If it's a file with the target name, return true
      return true;
    }
  }

  // If the file is not found in this folder or its subfolders, return false
  return false;
}

// Process all items in the JSON array asynchronously
async function processAllJsonData() {
  // Load assets data from the assets_old.json file
  let assetsData;
  try {
    assetsData = JSON.parse(await fs.readFile(assetsFilePath, 'utf-8'));
  } catch (error) {
    console.error(`Error reading assets data from '${assetsFilePath}':`, error);
    process.exit(1); // Terminate the script if there's an error reading the assets data
  }

  // Load jsonData from your JSON file
  const jsonData = JSON.parse(await fs.readFile(jsonFilePath, 'utf-8'));

  const existsResults = [];
  const notExistsResults = [];

  const processPromises = jsonData.map(async (data) => {
    const imageRegex = /<img src=["']([^"']+)["']/g;
    const imageNames = [];

    // Find image filenames in the JSON content
    while ((match = imageRegex.exec(data.question.text)) !== null) {
      const src = match[1];
      const isExtension = src.includes('.');

      // Check if the src contains an extension or not
      if (isExtension) {
        imageNames.push(src);
      } else {
        const imageName = getImageNameFromId(src, assetsData);
        if (imageName) {
          imageNames.push(imageName);
        }
      }
    }

    // Check if each image exists in S3
    const results = await Promise.all(imageNames.map(async (imageName) => {
      const exists = await checkImageExists(imageName);
      return { imageName, exists };
    }));

    results.forEach(async ({ imageName, exists }) => {
      if (exists) {
        console.log(`Image '${imageName}' exists in S3.`);
        existsResults.push(`Image '${imageName}' exists in S3.`);
      } else {
        console.log(`Image '${imageName}' does not exist in S3.`);

        const folderPath = ''; // Replace with your folder path
        const targetFileName = path.join(__dirname, 'txt files', imageName);

        const fileFound = await searchFileRecursive(folderPath, targetFileName);

        if (fileFound) {
          console.log(`File '${targetFileName}' found in '${folderPath}' or its subfolders.`);
        } else {
          console.log(`File '${targetFileName}' not found in '${folderPath}' or its subfolders.`);
          notExistsResults.push(`Image '${imageName}' does not exist in S3.`);
        }
      }
    });
  });

  await Promise.all(processPromises);

  // Create text files for images that exist and do not exist
  await createTextFile('images_exist_cbse.txt', existsResults.join('\n'));
  await createTextFile('images_not_exist_cbse.txt', notExistsResults.join('\n'));
}

// Usage: Process all items in the JSON array
processAllJsonData();
