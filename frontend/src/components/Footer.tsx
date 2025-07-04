import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-orange-100 border-t border-orange-200 mt-12">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 text-center text-stone-500 text-sm">
        <p>&copy; {new Date().getFullYear()} OFX Compliance Assistant. For illustrative purposes only.</p>
        <p className="mt-1">
            This is a demo application and should not be used for actual compliance decisions. 
            Always consult with qualified compliance professionals.
        </p>
      </div>
    </footer>
  );
};

export default Footer;