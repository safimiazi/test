"use client";
import React from "react";
import ImageUploader from "./ImageUploader";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import EditProfileForm from "./EditProfileForm";
import { motion } from "framer-motion";

const EditProfile = () => {
  const { currentUser } = useAuth();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="relative overflow-hidden border border-slate-700/50 dark:border-slate-700/50 bg-white/95 dark:bg-[rgba(2,18,36,0.88)] backdrop-blur-[10px] rounded-2xl p-8 shadow-xl dark:shadow-none"
    >
      <div
        className="absolute -top-14 left-1/2 transform -translate-x-1/2 w-28 h-28 rounded-full bg-gradient-radial from-blue-900/12 via-blue-900/6 to-transparent z-0 pointer-events-none"
        aria-hidden
      />
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl pointer-events-none z-0 bg-gradient-to-br from-gray-50/80 via-white/70 to-gray-100/90 dark:from-[rgba(3,20,40,0.98)]/95 dark:via-[rgba(6,22,46,0.88)]/80 dark:to-[rgba(3,18,38,0.98)]/95"
      />
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl pointer-events-none z-1 bg-gradient-to-b from-white/60 to-transparent opacity-40 dark:from-white/8 dark:via-white/4 dark:to-transparent dark:opacity-20"
      />
      <div className="relative z-10 space-y-8">
        <ImageUploader userName={currentUser?.name} />
        <EditProfileForm />
      </div>
    </motion.div>
  );
};

export default EditProfile;
