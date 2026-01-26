import React, { useState } from 'react';

const FileInput = ({ label, name, onFileChange, multiple = false, required = false, isImageUpload = false }) => {
  const [warning, setWarning] = useState('');

  const handleFileChange = (e) => {
    const files = e.target.files;
    
    // Validate file types if this is an image upload field
    if (isImageUpload && files && files.length > 0) {
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      let hasInvalidFile = false;
      
      for (let i = 0; i < files.length; i++) {
        if (!validImageTypes.includes(files[i].type)) {
          hasInvalidFile = true;
          break;
        }
      }
      
      if (hasInvalidFile) {
        setWarning('⚠️ Fail bukan gambar dikesan. Sila muat naik gambar (JPG / PNG) sahaja.');
      } else {
        setWarning('');
      }
    }
    
    // Call the original onChange handler
    if (onFileChange) {
      onFileChange(e);
    }
  };

  return (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="file"
        name={name}
        id={name}
        onChange={handleFileChange}
        multiple={multiple}
        required={required}
        accept={isImageUpload ? "image/jpeg,image/png" : undefined}
        className="mt-1 block w-full text-sm text-gray-500
                   file:mr-4 file:py-2 file:px-4
                   file:rounded-md file:border-0
                   file:text-sm file:font-semibold
                   file:bg-blue-50 file:text-blue-700
                   hover:file:bg-blue-100"
      />
      {isImageUpload && (
        <p className="mt-1 text-xs text-gray-500">
          Format dibenarkan: JPG, JPEG, PNG sahaja<br />
          ❌ PDF, ZIP, Word, Google Drive link tidak diterima
        </p>
      )}
      {warning && (
        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded text-sm text-yellow-800">
          {warning}
        </div>
      )}
    </div>
  );
};

export default FileInput;