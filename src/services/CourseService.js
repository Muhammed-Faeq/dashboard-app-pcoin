import { db, auth } from '../firebase/firebase';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  query,
  orderBy,
  limit,
  where,
  increment,
  runTransaction,
  Timestamp
} from 'firebase/firestore';

class CourseService {
  // Fix for getAllCourses to correctly handle collections
  async getAllCourses() {
    try {
      console.log('Getting all courses from Firestore');
      const coursesCollection = collection(db, 'Courses');
      const courseSnapshot = await getDocs(query(coursesCollection, orderBy('createdAt', 'desc')));
      console.log(`Found ${courseSnapshot.docs.length} courses`);
      
      // Return courses with their document IDs
      return courseSnapshot.docs.map(doc => {
        const data = doc.data();
        // Explicitly add the document ID to the course object
        return {
          id: doc.id,
          ...data
        };
      });
    } catch (error) {
      console.error('Error getting courses:', error);
      throw error;
    }
  }

  // Fix for getCourseById method
  async getCourseById(courseId) {
    try {
      console.log(`Getting course with ID: ${courseId}`);
      // Use doc() to get a reference to a specific document in the collection
      const courseDocRef = doc(db, 'Courses', courseId);
      const courseDoc = await getDoc(courseDocRef);
      
      if (courseDoc.exists()) {
        const data = courseDoc.data();
        // Explicitly include the ID in the returned object
        return {
          id: courseId,  // Use the passed courseId to ensure it's included
          ...data
        };
      } else {
        throw new Error('Course not found');
      }
    } catch (error) {
      console.error('Error getting course:', error);
      throw error;
    }
  }

  // Create a new course
  async createCourse(courseData) {
    try {
      console.log('Creating new course:', courseData.title);
      
      // Process lessons to ensure proper structure
      const processedLessons = courseData.lessons.map(lesson => ({
        id: lesson.id || crypto.randomUUID(), // More reliable unique ID
        title: lesson.title,
        description: lesson.description || '',
        videoUrl: lesson.videoUrl || '',
        duration: lesson.duration || 30,
        resources: (lesson.resources || []).map(resource => ({
          id: resource.id || crypto.randomUUID(),
          title: resource.title || '',
          type: resource.type || 'pdf',
          url: resource.url || ''
        })),
        // Add default empty quiz structure to each lesson
        quiz: lesson.quiz || {
          id: crypto.randomUUID(),
          title: `${lesson.title} Quiz`,
          description: 'Test your knowledge of this lesson',
          questions: [],
          timeLimit: 10, // Default time limit in minutes
          passingScore: 70, // Default passing score percentage
          attempts: 0,
          isEnabled: false
        },
        isPreview: lesson.isPreview || false,
        isLocked: lesson.isLocked || false,
        isCompleted: false

      }));
  
      // Calculate total duration from all lessons
      const totalDuration = processedLessons.reduce(
        (total, lesson) => total + (lesson.duration || 0), 
        0
      );
      
      // Create a new course document with final exam structure
      const courseDoc = {
        title: courseData.title,
        description: courseData.description || '',
        imageUrl: courseData.imageUrl || '',
        categoryId: courseData.categoryId || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        rating: courseData.rating || 0,
        reviewCount: courseData.reviewCount || 0,
        enrollmentCount: courseData.enrollmentCount || 0,
        isPremium: courseData.isPremium || false,
        difficulty: courseData.difficulty || 'Beginner',
        duration: totalDuration,
        lessons: processedLessons,
        // Add final exam structure
        finalExam: courseData.finalExam || {
          id: crypto.randomUUID(),
          title: `${courseData.title} Final Exam`,
          description: 'Test your understanding of the entire course',
          questions: [],
          timeLimit: 30, // Default time limit in minutes
          passingScore: 70, // Default passing percentage
          isEnabled: false,
          requireAllLessonsCompleted: true
        },
        // Include any other fields from courseData not explicitly handled
        ...Object.fromEntries(
          Object.entries(courseData).filter(([key]) => 
            !['title', 'description', 'imageUrl', 'categoryId', 'rating', 
              'reviewCount', 'enrollmentCount', 'isPremium', 'difficulty', 
              'lessons', 'finalExam'].includes(key)
          )
        )
      };
      
      // Add to Firestore collection
      const coursesCollection = collection(db, 'Courses');
      const docRef = await addDoc(coursesCollection, courseDoc);
      
      // Update the document with its own ID
      await updateDoc(docRef, { id: docRef.id });
      
      console.log(`Course created with ID: ${docRef.id}`);
      
      return {
        id: docRef.id,
        ...courseDoc,
        createdAt: new Date(), // Convert timestamp to Date for client use
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Error creating course:', error);
      throw error;
    }
  }

  // Update an existing course
  async updateCourse(courseId, courseData) {
    try {
      console.log(`Updating course with ID: ${courseId}`);
      const courseRef = doc(db, 'Courses', courseId);
      
      // Process lessons to ensure proper structure
      const processedLessons = courseData.lessons.map(lesson => {
        // Ensure quiz structure exists for each lesson
        const quiz = lesson.quiz || {
          id: crypto.randomUUID(),
          title: `${lesson.title} Quiz`,
          description: 'Test your knowledge of this lesson',
          questions: [],
          timeLimit: 10,
          passingScore: 70,
          attemptsAllowed: 0,
          isEnabled: false,
          shuffleQuestions: false,
          shuffleOptions: false,
          showFeedback: true,
          allowReview: true
        };

        return {
          id: lesson.id || crypto.randomUUID(),
          title: lesson.title,
          description: lesson.description || '',
          videoUrl: lesson.videoUrl || '',
          duration: lesson.duration || 30,
          resources: (lesson.resources || []).map(resource => ({
            id: resource.id || crypto.randomUUID(),
            title: resource.title || '',
            type: resource.type || 'pdf',
            url: resource.url || ''
          })),
          quiz: quiz,
          isPreview: lesson.isPreview || false,
          isLocked: lesson.isLocked || false,
          isCompleted: lesson.isCompleted || false
        };
      });
      
      // Calculate total course duration
      const totalDuration = processedLessons.reduce((total, lesson) => total + (lesson.duration || 0), 0);
      
      // Ensure final exam structure
      const finalExam = courseData.finalExam || {
        id: crypto.randomUUID(),
        title: `${courseData.title} Final Exam`,
        description: 'Test your understanding of the entire course',
        questions: [],
        timeLimit: 30,
        passingScore: 70,
        isEnabled: false,
        requireAllLessonsCompleted: true
      };
      
      // Prepare update data
      const updateData = {
        ...courseData,
        lessons: processedLessons,
        finalExam: finalExam,
        updatedAt: serverTimestamp(),
        duration: totalDuration,
        difficulty: courseData.difficulty || 'Beginner'
      };
      
      await updateDoc(courseRef, updateData);
      
      // Update all active enrollments with the new lesson structure
      this.updateEnrollmentsAfterCourseChange(courseId, processedLessons);
      
      console.log('Course updated successfully');
      return {
        id: courseId,
        ...updateData
      };
    } catch (error) {
      console.error('Error updating course:', error);
      throw error;
    }
  }

  // Delete a course
  async deleteCourse(courseId) {
    try {
      console.log(`Deleting course with ID: ${courseId}`);
      
      // First, find all enrollments for this course
      const enrollmentsQuery = query(
        collection(db, 'Enrollments'),
        where('courseId', '==', courseId)
      );
      
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      
      if (!enrollmentsSnapshot.empty) {
        console.log(`Found ${enrollmentsSnapshot.docs.length} enrollments to remove`);
        
        // Delete all enrollments in a batch
        const batch = db.batch();
        
        enrollmentsSnapshot.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log('Related enrollments deleted');
      }
      
      // Delete quiz attempts
      try {
        const quizAttemptsQuery = query(
          collection(db, 'QuizAttempts'),
          where('courseId', '==', courseId)
        );
        const quizAttemptsSnapshot = await getDocs(quizAttemptsQuery);
        
        if (!quizAttemptsSnapshot.empty) {
          console.log(`Found ${quizAttemptsSnapshot.docs.length} quiz attempts to remove`);
          
          const batch = db.batch();
          quizAttemptsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          await batch.commit();
          console.log('Related quiz attempts deleted');
        }
      } catch (error) {
        console.error('Error deleting quiz attempts:', error);
      }
      
      // Delete final exam attempts
      try {
        const examAttemptsQuery = query(
          collection(db, 'ExamAttempts'),
          where('courseId', '==', courseId)
        );
        const examAttemptsSnapshot = await getDocs(examAttemptsQuery);
        
        if (!examAttemptsSnapshot.empty) {
          console.log(`Found ${examAttemptsSnapshot.docs.length} exam attempts to remove`);
          
          const batch = db.batch();
          examAttemptsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          await batch.commit();
          console.log('Related exam attempts deleted');
        }
      } catch (error) {
        console.error('Error deleting exam attempts:', error);
      }
      
      // Delete the course document
      await deleteDoc(doc(db, 'Courses', courseId));
      console.log('Course deleted successfully');
      
      return true;
    } catch (error) {
      console.error('Error deleting course:', error);
      throw error;
    }
  }

  // Assign course to a user with improved tracking
  async assignCourseToUser(userId, courseId) {
    try {
      // Validate inputs
      if (!userId || !courseId) {
        console.error('Invalid userId or courseId:', { userId, courseId });
        throw new Error('Invalid userId or courseId');
      }
      
      console.log(`Assigning course ${courseId} to user ${userId}`);
      
      // Run as a transaction to ensure all operations succeed or fail together
      return await runTransaction(db, async (transaction) => {
        // Get course details
        const courseRef = doc(db, 'Courses', courseId);
        const courseDoc = await transaction.get(courseRef);
        
        if (!courseDoc.exists()) {
          throw new Error(`Course ${courseId} not found`);
        }
        
        const courseData = courseDoc.data();
        const courseTitle = courseData.title || 'Unknown Course';
        
        // Check if user already enrolled
        const enrollmentId = `${userId}_${courseId}`;
        const enrollmentRef = doc(db, 'Enrollments', enrollmentId);
        const existingEnrollment = await transaction.get(enrollmentRef);
        
        if (existingEnrollment.exists()) {
          console.log(`User ${userId} already enrolled in course ${courseId}`);
          return {
            success: true,
            message: 'User already enrolled in this course',
            courseId,
            courseTitle,
            enrollmentId
          };
        }
        
        // Create enhanced enrollment tracking with lesson progress
        const lessons = courseData.lessons || [];
        const lessonProgress = lessons.map(lesson => {
          const quiz = lesson.quiz || { id: null };
          
          return {
            lessonId: lesson.id,
            completed: false,
            startedAt: null,
            completedAt: null,
            timeSpent: 0,
            // Add quiz progress tracking
            quizAttempts: [],
            quizCompleted: false,
            quizBestScore: 0,
            quizLastAttemptDate: null,
            quizId: quiz.id,
            resources: (lesson.resources || []).map(resource => ({
              resourceId: resource.id,
              accessed: false,
              downloadCount: 0
            }))
          };
        });
        
        // Create enrollment document with detailed tracking
        const finalExam = courseData.finalExam || { id: null };
        
        transaction.set(enrollmentRef, {
          userId: userId,
          courseId: courseId,
          courseTitle: courseTitle,
          enrolledAt: serverTimestamp(),
          progress: 0,
          lastAccessed: serverTimestamp(),
          isCompleted: false,
          status: 'active',
          lessonProgress: lessonProgress,
          totalLessons: lessons.length,
          completedLessons: 0,
          // Add exam progress tracking
          examAttempts: [],
          examCompleted: false,
          examBestScore: 0,
          examLastAttemptDate: null,
          examId: finalExam.id,
          certificateIssued: false,
          notes: []
        });
        
        // Update course enrollment count
        transaction.update(courseRef, {
          enrollmentCount: increment(1),
          updatedAt: serverTimestamp()
        });
        
        // For backward compatibility - UserTasks collection
        const userEnrollmentRef = doc(db, `UserTasks/${userId}/EnrolledCourses`, courseId);
        transaction.set(userEnrollmentRef, {
          courseId: courseId,
          courseTitle: courseTitle,
          enrolledAt: serverTimestamp(),
          progress: 0,
          lastAccessedAt: serverTimestamp(),
          isCompleted: false,
          lessonProgress: lessonProgress
        });
        
        console.log(`Successfully enrolled user ${userId} in course ${courseId}`);
        
        return {
          success: true,
          message: 'Successfully enrolled user in course',
          courseId,
          courseTitle,
          enrollmentId
        };
      });
    } catch (error) {
      console.error('Error in course assignment:', error);
      throw error;
    }
  }

  // Update lesson progress for a user
  async updateLessonProgress(courseId, lessonId, progress) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const userId = currentUser.uid;
      const enrollmentId = `${userId}_${courseId}`;
      const enrollmentRef = doc(db, 'Enrollments', enrollmentId);
      
      // Get current enrollment
      const enrollmentDoc = await getDoc(enrollmentRef);
      
      if (!enrollmentDoc.exists()) {
        throw new Error('Enrollment not found');
      }
      
      const enrollmentData = enrollmentDoc.data();
      const lessonProgress = enrollmentData.lessonProgress || [];
      
      // Find the lesson in progress array
      const lessonIndex = lessonProgress.findIndex(item => item.lessonId === lessonId);
      
      if (lessonIndex === -1) {
        throw new Error('Lesson not found in enrollment');
      }
      
      // Update lesson progress
      const updatedLessonProgress = [...lessonProgress];
      const isCompleted = progress >= 100;
      
      // Only mark as completed if it wasn't already completed
      const wasCompletedBefore = updatedLessonProgress[lessonIndex].completed;
      
      updatedLessonProgress[lessonIndex] = {
        ...updatedLessonProgress[lessonIndex],
        completed: isCompleted,
        completedAt: isCompleted && !wasCompletedBefore ? serverTimestamp() : updatedLessonProgress[lessonIndex].completedAt,
        startedAt: updatedLessonProgress[lessonIndex].startedAt || serverTimestamp(),
        timeSpent: (updatedLessonProgress[lessonIndex].timeSpent || 0) + 60 // Add 1 minute of progress
      };
      
      // Calculate overall course progress - now also accounting for quiz completion
      const courseProgress = this.calculateCourseProgress(updatedLessonProgress);
      
      // Update enrollment
      await updateDoc(enrollmentRef, {
        lessonProgress: updatedLessonProgress,
        progress: courseProgress.overallProgress,
        completedLessons: courseProgress.completedLessons,
        isCompleted: courseProgress.isCompleted,
        lastAccessed: serverTimestamp()
      });
      
      // Update legacy format too
      try {
        const userEnrollmentRef = doc(db, `UserTasks/${userId}/EnrolledCourses`, courseId);
        await updateDoc(userEnrollmentRef, {
          progress: courseProgress.overallProgress,
          lastAccessedAt: serverTimestamp(),
          isCompleted: courseProgress.isCompleted,
          lessonProgress: updatedLessonProgress
        });
      } catch (error) {
        console.warn('Could not update legacy enrollment format:', error);
      }
      
      // If course is completed, update user stats and maybe issue certificate
      if (courseProgress.isCompleted && !enrollmentData.isCompleted) {
        this.handleCourseCompletion(userId, courseId);
      }
      
      return {
        success: true,
        progress: courseProgress.overallProgress,
        lessonProgress: updatedLessonProgress[lessonIndex]
      };
    } catch (error) {
      console.error('Error updating lesson progress:', error);
      throw error;
    }
  }

  // Calculate overall course progress including lessons, quizzes, and exams
  calculateCourseProgress(lessonProgress) {
    const totalLessons = lessonProgress.length;
    let completedItems = 0;
    let totalItems = 0;
    
    // Count lesson content completion
    lessonProgress.forEach(lesson => {
      totalItems++;
      if (lesson.completed) completedItems++;
      
      // Count quiz completion if quiz exists
      if (lesson.quizId) {
        totalItems++;
        if (lesson.quizCompleted) completedItems++;
      }
    });
    
    // Calculate percentage (lessons and quizzes)
    const overallProgress = Math.round((completedItems / totalItems) * 100);
    const completedLessons = lessonProgress.filter(lesson => lesson.completed).length;
    
    return {
      overallProgress,
      completedLessons,
      completedItems,
      totalItems,
      isCompleted: overallProgress === 100
    };
  }

  // Track resource access
  async trackResourceAccess(courseId, lessonId, resourceId) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const userId = currentUser.uid;
      const enrollmentId = `${userId}_${courseId}`;
      const enrollmentRef = doc(db, 'Enrollments', enrollmentId);
      
      // Run as transaction to ensure data consistency
      await runTransaction(db, async (transaction) => {
        const enrollmentDoc = await transaction.get(enrollmentRef);
        
        if (!enrollmentDoc.exists()) {
          throw new Error('Enrollment not found');
        }
        
        const enrollmentData = enrollmentDoc.data();
        const lessonProgress = enrollmentData.lessonProgress || [];
        
        // Find the lesson
        const lessonIndex = lessonProgress.findIndex(item => item.lessonId === lessonId);
        
        if (lessonIndex === -1) {
          throw new Error('Lesson not found in enrollment');
        }
        
        const lesson = lessonProgress[lessonIndex];
        const resources = lesson.resources || [];
        
        // Find the resource
        const resourceIndex = resources.findIndex(item => item.resourceId === resourceId);
        
        if (resourceIndex === -1) {
          throw new Error('Resource not found in lesson');
        }
        
        // Update resource access
        const updatedResources = [...resources];
        updatedResources[resourceIndex] = {
          ...updatedResources[resourceIndex],
          accessed: true,
          downloadCount: (updatedResources[resourceIndex].downloadCount || 0) + 1,
          lastAccessed: serverTimestamp()
        };
        
        // Update lesson progress with new resource data
        const updatedLessonProgress = [...lessonProgress];
        updatedLessonProgress[lessonIndex] = {
          ...updatedLessonProgress[lessonIndex],
          resources: updatedResources
        };
        
        // Update enrollment with timestamp
        transaction.update(enrollmentRef, {
          lessonProgress: updatedLessonProgress,
          lastAccessed: serverTimestamp()
        });
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error tracking resource access:', error);
      throw error;
    }
  }

  // Handle course completion
  async handleCourseCompletion(userId, courseId) {
    try {
      console.log(`Handling completion for course ${courseId} by user ${userId}`);
      
      const enrollmentId = `${userId}_${courseId}`;
      const enrollmentRef = doc(db, 'Enrollments', enrollmentId);
      
      // Check if final exam is required
      const courseDoc = await getDoc(doc(db, 'Courses', courseId));
      if (!courseDoc.exists()) {
        throw new Error('Course not found');
      }
      
      const courseData = courseDoc.data();
      const finalExam = courseData.finalExam || {};
      
      // If final exam is enabled, check if it's completed
      let canComplete = true;
      if (finalExam.isEnabled) {
        const enrollmentDoc = await getDoc(enrollmentRef);
        if (!enrollmentDoc.exists()) {
          throw new Error('Enrollment not found');
        }
        
        const enrollmentData = enrollmentDoc.data();
        canComplete = enrollmentData.examCompleted || false;
        
        if (!canComplete) {
          console.log('Course completion blocked - final exam not completed');
          return { 
            success: false, 
            message: 'Final exam must be completed before course can be marked as completed' 
          };
        }
      }
      
      // Mark as completed
      await updateDoc(enrollmentRef, {
        isCompleted: true,
        completedAt: serverTimestamp(),
        certificateIssued: true,
        certificateIssuedAt: serverTimestamp()
      });
      
      // Generate a completion certificate ID
      const certificateId = `CERT-${userId.substring(0, 4)}-${courseId.substring(0, 4)}-${Date.now().toString(36)}`;
      
      // Add course completion to user achievements
      const achievementRef = doc(db, `UserTasks/${userId}/Achievements`, certificateId);
      await setDoc(achievementRef, {
        type: 'course_completion',
        courseId: courseId,
        achievedAt: serverTimestamp(),
        certificateId: certificateId
      });
      
      console.log(`Course ${courseId} marked as completed for user ${userId}`);
      return { success: true, certificateId };
    } catch (error) {
      console.error('Error handling course completion:', error);
      // Don't throw here - this is a background operation
      return { success: false, error: error.message };
    }
  }

  // Add note to course
  async addCourseNote(courseId, lessonId, noteText) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const userId = currentUser.uid;
      const enrollmentId = `${userId}_${courseId}`;
      const enrollmentRef = doc(db, 'Enrollments', enrollmentId);
      
      // Create note object
      const note = {
        id: Date.now().toString(),
        lessonId: lessonId,
        text: noteText,
        createdAt: serverTimestamp()
      };
      
      // Update enrollment with new note
      await updateDoc(enrollmentRef, {
        notes: arrayUnion(note),
        lastAccessed: serverTimestamp()
      });
      
      return { success: true, note };
    } catch (error) {
      console.error('Error adding course note:', error);
      throw error;
    }
  }

  // Get user course progress
  async getUserCourseProgress(courseId) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const userId = currentUser.uid;
      const enrollmentId = `${userId}_${courseId}`;
      
      const enrollmentDoc = await getDoc(doc(db, 'Enrollments', enrollmentId));
      
      if (!enrollmentDoc.exists()) {
        return {
          enrolled: false,
          progress: 0,
          isCompleted: false
        };
      }
      
      const enrollmentData = enrollmentDoc.data();
      
      // Mark enrollment as accessed
      await updateDoc(doc(db, 'Enrollments', enrollmentId), {
        lastAccessed: serverTimestamp()
      });
      
      return {
        enrolled: true,
        progress: enrollmentData.progress || 0,
        isCompleted: enrollmentData.isCompleted || false,
        lastAccessed: enrollmentData.lastAccessed,
        enrolledAt: enrollmentData.enrolledAt,
        lessonProgress: enrollmentData.lessonProgress || [],
        notes: enrollmentData.notes || [],
        completedLessons: enrollmentData.completedLessons || 0,
        totalLessons: enrollmentData.totalLessons || 0,
        examAttempts: enrollmentData.examAttempts || [],
        examCompleted: enrollmentData.examCompleted || false,
        examBestScore: enrollmentData.examBestScore || 0
      };
    } catch (error) {
      console.error('Error getting user course progress:', error);
      throw error;
    }
  }

  // Update enrollments after course structure changes
  async updateEnrollmentsAfterCourseChange(courseId, updatedLessons) {
    try {
      // Find all enrollments for this course
      const enrollmentsQuery = query(
        collection(db, 'Enrollments'),
        where('courseId', '==', courseId)
      );
      
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      
      if (enrollmentsSnapshot.empty) {
        console.log('No enrollments found for this course');
        return;
      }
      
      console.log(`Updating ${enrollmentsSnapshot.docs.length} enrollments with new lesson structure`);
      
      // Process each enrollment
      const batch = db.batch();
      
      for (const enrollDoc of enrollmentsSnapshot.docs) {
        const enrollData = enrollDoc.data();
        const currentLessonProgress = enrollData.lessonProgress || [];
        
        // Create map of existing lesson progress
        const progressMap = {};
        currentLessonProgress.forEach(lessonProgress => {
          progressMap[lessonProgress.lessonId] = lessonProgress;
        });
        
        // Create updated lesson progress array
        const updatedLessonProgress = updatedLessons.map(lesson => {
          const existingProgress = progressMap[lesson.id] || null;
          const quiz = lesson.quiz || { id: null };
          
          if (existingProgress) {
            // Keep existing progress but ensure resource array is up to date
            const resources = (lesson.resources || []).map(resource => {
              const existingResourceProgress = (existingProgress.resources || [])
                .find(r => r.resourceId === resource.id);
                
              return existingResourceProgress || {
                resourceId: resource.id,
                accessed: false,
                downloadCount: 0
              };
            });
            
            return {
              ...existingProgress,
              resources,
              // Update quiz ID if needed
              quizId: quiz.id
            };
          } else {
            // Create new progress entry for this lesson
            return {
              lessonId: lesson.id,
              completed: false,
              startedAt: null,
              completedAt: null,
              timeSpent: 0,
              quizAttempts: [],
              quizCompleted: false,
              quizBestScore: 0,
              quizLastAttemptDate: null,
              quizId: quiz.id,
              resources: (lesson.resources || []).map(resource => ({
                resourceId: resource.id,
                accessed: false,
                downloadCount: 0
              }))
            };
          }
        });
        
        // Calculate updated progress metrics
        const courseProgress = this.calculateCourseProgress(updatedLessonProgress);
        
        // Update enrollment document
        batch.update(enrollDoc.ref, {
          lessonProgress: updatedLessonProgress,
          progress: courseProgress.overallProgress,
          totalLessons: updatedLessons.length,
          completedLessons: courseProgress.completedLessons,
          isCompleted: courseProgress.isCompleted,
          updatedAt: serverTimestamp()
        });
      }
      
      await batch.commit();
      console.log('Successfully updated all enrollments with new lesson structure');
      
      return true;
    } catch (error) {
      console.error('Error updating enrollments after course change:', error);
      return false;
    }
  }

  // Get all enrolled users for a course (admin function)
  // Get all enrolled users for a course (admin function)
async getCourseEnrollments(courseId) {
  try {
    if (!courseId) {
      console.error('Course ID is required');
      return {
        success: false,
        error: 'Course ID is required'
      };
    }
    
    console.log(`Getting enrollments for course ${courseId}`);
    
    // Check if course exists
    const courseRef = doc(db, 'Courses', courseId);
    const courseDoc = await getDoc(courseRef);
    if (!courseDoc.exists()) {
      console.warn(`Course with ID ${courseId} not found`);
      return {
        success: false,
        error: 'Course not found'
      };
    }
    
    // Modified query - removed orderBy to avoid index requirement
    const enrollmentsQuery = query(
      collection(db, 'Enrollments'),
      where('courseId', '==', courseId)
      // Removed: orderBy('enrolledAt', 'desc')
    );
    
    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    
    if (enrollmentsSnapshot.empty) {
      return {
        success: true,
        enrollments: []
      };
    }
    
    // Get user details for each enrollment
    const enrollments = [];
    
    for (const enrollDoc of enrollmentsSnapshot.docs) {
      const enrollData = enrollDoc.data();
      
      // Get user info
      try {
        const userDoc = await getDoc(doc(db, 'Users', enrollData.userId));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          enrollments.push({
            id: enrollDoc.id,
            ...enrollData,
            user: {
              id: userDoc.id,
              email: userData.Email || userData.email,
              firstName: userData.FirstName || userData.firstName,
              lastName: userData.LastName || userData.lastName,
              profilePicture: userData.ProfilePicture || userData.profilePicture
            },
            // Convert timestamps to dates for client use
            enrolledAtDate: enrollData.enrolledAt?.toDate() || null,
            lastAccessedDate: enrollData.lastAccessed?.toDate() || null,
            completedAtDate: enrollData.completedAt?.toDate() || null
          });
        } else {
          // User not found, include enrollment with minimal info
          enrollments.push({
            id: enrollDoc.id,
            ...enrollData,
            user: {
              id: enrollData.userId,
              email: 'User not found',
              firstName: '',
              lastName: ''
            },
            // Convert timestamps to dates for client use
            enrolledAtDate: enrollData.enrolledAt?.toDate() || null,
            lastAccessedDate: enrollData.lastAccessed?.toDate() || null
          });
        }
      } catch (error) {
        console.error(`Error getting user data for enrollment ${enrollDoc.id}:`, error);
        // Include enrollment even if user data cannot be retrieved
        enrollments.push({
          id: enrollDoc.id,
          ...enrollData,
          user: {
            id: enrollData.userId,
            email: 'Error retrieving user data',
            firstName: '',
            lastName: ''
          }
        });
      }
    }
    
    // Sort manually in memory instead of using Firestore orderBy
    const sortedEnrollments = enrollments.sort((a, b) => {
      // Handle missing enrolledAt
      if (!a.enrolledAt) return 1;  // Move items without dates to the end
      if (!b.enrolledAt) return -1;
      
      // Sort by enrolledAt (newest first)
      return b.enrolledAt.seconds - a.enrolledAt.seconds;
    });
    
    console.log(`Found ${sortedEnrollments.length} enrollments for course ${courseId}`);
    
    return {
      success: true,
      enrollments: sortedEnrollments
    };
  } catch (error) {
    console.error('Error getting course enrollments:', error);
    
    // Special handling for common errors
    if (error.message && error.message.includes('requires an index')) {
      console.log('Index-related error handled through client-side sorting');
      return {
        success: false,
        error: 'Query error',
        message: 'Error retrieving enrollments'
      };
    }
    
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

  // Get popular courses based on enrollment count
  async getPopularCourses(limit = 5) {
    try {
      const coursesQuery = query(
        collection(db, 'Courses'),
        orderBy('enrollmentCount', 'desc'),
        limit(limit)
      );
      
      const snapshot = await getDocs(coursesQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting popular courses:', error);
      throw error;
    }
  }

  // Find courses by category
  async getCoursesByCategory(categoryId, limit = 20) {
    try {
      const coursesQuery = query(
        collection(db, 'Courses'),
        where('categoryId', '==', categoryId),
        orderBy('createdAt', 'desc'),
        limit(limit)
      );
      
      const snapshot = await getDocs(coursesQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting courses by category:', error);
      throw error;
    }
  }
  
  // Get courses by instructor
  async getCoursesByInstructor(instructorId, limit = 20) {
    try {
      const coursesQuery = query(
        collection(db, 'Courses'),
        where('instructorId', '==', instructorId),
        orderBy('createdAt', 'desc'),
        limit(limit)
      );
      
      const snapshot = await getDocs(coursesQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting courses by instructor:', error);
      throw error;
    }
  }

  // Search courses
  async searchCourses(searchTerm) {
    try {
      // Get all courses (Firestore doesn't support text search natively)
      const coursesCollection = collection(db, 'Courses');
      const snapshot = await getDocs(coursesCollection);
      
      if (snapshot.empty) {
        return [];
      }
      
      // Filter courses locally based on search term
      const term = searchTerm.toLowerCase();
      return snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(course => {
          const title = (course.title || '').toLowerCase();
          const description = (course.description || '').toLowerCase();
          
          return title.includes(term) || description.includes(term);
        });
    } catch (error) {
      console.error('Error searching courses:', error);
      throw error;
    }
  }

  // Get user course statistics
  async getUserCourseStats(userId = null) {
    try {
      // If userId is not provided, use current user's ID
      let targetUserId = userId;
      if (!targetUserId) {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('User not authenticated');
        }
        targetUserId = currentUser.uid;
      }
      
      // Query all enrollments for this user
      const enrollmentsQuery = query(
        collection(db, 'Enrollments'),
        where('userId', '==', targetUserId)
      );
      
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      
      if (enrollmentsSnapshot.empty) {
        return {
          totalCourses: 0,
          completedCourses: 0,
          inProgressCourses: 0,
          totalLessons: 0,
          completedLessons: 0,
          averageProgress: 0,
          timeSpent: 0,
          quizzesCompleted: 0,
          avgQuizScore: 0,
          examsCompleted: 0,
          avgExamScore: 0
        };
      }
      
      // Aggregate statistics
      let totalCourses = enrollmentsSnapshot.docs.length;
      let completedCourses = 0;
      let totalLessons = 0;
      let completedLessons = 0;
      let totalProgress = 0;
      let timeSpent = 0;
      let quizzesCompleted = 0;
      let totalQuizScore = 0;
      let quizAttempts = 0;
      let examsCompleted = 0;
      let totalExamScore = 0;
      let examAttempts = 0;
      
      enrollmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Course completion
        if (data.isCompleted) {
          completedCourses++;
        }
        
        // Lessons
        totalLessons += data.totalLessons || 0;
        completedLessons += data.completedLessons || 0;
        
        // Progress
        totalProgress += data.progress || 0;
        
        // Time spent
        if (data.lessonProgress) {
          data.lessonProgress.forEach(lesson => {
            timeSpent += lesson.timeSpent || 0;
            
            // Quiz stats
            if (lesson.quizCompleted) {
              quizzesCompleted++;
            }
            
            if (lesson.quizAttempts && lesson.quizAttempts.length > 0) {
              quizAttempts += lesson.quizAttempts.length;
              
              // Get highest score
              const highestScore = Math.max(...lesson.quizAttempts.map(a => a.score || 0));
              totalQuizScore += highestScore;
            }
          });
        }
        
        // Exam stats
        if (data.examCompleted) {
          examsCompleted++;
        }
        
        if (data.examAttempts && data.examAttempts.length > 0) {
          examAttempts += data.examAttempts.length;
          
          // Get highest score
          const highestScore = Math.max(...data.examAttempts.map(a => a.score || 0));
          totalExamScore += highestScore;
        }
      });
      
      const averageProgress = totalCourses > 0 ? Math.round(totalProgress / totalCourses) : 0;
      const avgQuizScore = quizzesCompleted > 0 ? Math.round(totalQuizScore / quizzesCompleted) : 0;
      const avgExamScore = examsCompleted > 0 ? Math.round(totalExamScore / examsCompleted) : 0;
      
      return {
        totalCourses,
        completedCourses,
        inProgressCourses: totalCourses - completedCourses,
        totalLessons,
        completedLessons,
        averageProgress,
        timeSpent, // time in seconds
        quizzesCompleted,
        quizAttempts,
        avgQuizScore,
        examsCompleted,
        examAttempts,
        avgExamScore
      };
    } catch (error) {
      console.error('Error getting user course statistics:', error);
      throw error;
    }
  }

  // =========================================================================
  // NEW QUIZ RELATED METHODS
  // =========================================================================

  // Create or update a lesson quiz
  async createOrUpdateLessonQuiz(courseId, lessonId, quizData) {
    try {
      console.log(`Creating/updating quiz for lesson ${lessonId} in course ${courseId}`);
      
      // Input validation
      if (!quizData.questions || !Array.isArray(quizData.questions)) {
        throw new Error('Invalid quiz data: questions must be an array');
      }
      
      // Process and validate questions
      const processedQuestions = quizData.questions.map(question => {
        // Common question properties
        const baseQuestion = {
          id: question.id || crypto.randomUUID(),
          text: question.text || '',
          type: question.type || 'multiple-choice',
          points: question.points || 1,
          explanation: question.explanation || ''
        };
        
        // Process based on question type
        switch (question.type) {
          case 'multiple-choice':
            if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
              throw new Error('Multiple choice questions must have at least 2 options');
            }
            if (question.correctAnswer === undefined || question.correctAnswer === null) {
              throw new Error('Multiple choice questions must specify a correctAnswer');
            }
            return {
              ...baseQuestion,
              options: question.options.map((option, index) => ({
                id: option.id || `option-${index}`,
                text: option.text || ''
              })),
              correctAnswer: question.correctAnswer
            };
            
          case 'true-false':
            return {
              ...baseQuestion,
              correctAnswer: !!question.correctAnswer // Ensure boolean
            };
            
          case 'multiple-answer':
            if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
              throw new Error('Multiple answer questions must have at least 2 options');
            }
            if (!question.correctAnswers || !Array.isArray(question.correctAnswers)) {
              throw new Error('Multiple answer questions must specify correctAnswers array');
            }
            return {
              ...baseQuestion,
              options: question.options.map((option, index) => ({
                id: option.id || `option-${index}`,
                text: option.text || ''
              })),
              correctAnswers: question.correctAnswers
            };
            
          case 'text':
            if (!question.correctAnswers || !Array.isArray(question.correctAnswers)) {
              throw new Error('Text questions must specify correctAnswers array');
            }
            return {
              ...baseQuestion,
              correctAnswers: question.correctAnswers,
              caseSensitive: question.caseSensitive || false
            };
            
          case 'matching':
            if (!question.pairs || !Array.isArray(question.pairs) || question.pairs.length < 2) {
              throw new Error('Matching questions must have at least 2 pairs');
            }
            return {
              ...baseQuestion,
              pairs: question.pairs.map((pair, index) => ({
                id: pair.id || `pair-${index}`,
                left: pair.left || '',
                right: pair.right || ''
              }))
            };
            
          default:
            throw new Error(`Unsupported question type: ${question.type}`);
        }
      });
      
      // Get the course document
      const courseRef = doc(db, 'Courses', courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (!courseDoc.exists()) {
        throw new Error('Course not found');
      }
      
      const courseData = courseDoc.data();
      const lessons = courseData.lessons || [];
      
      // Find the lesson
      const lessonIndex = lessons.findIndex(lesson => lesson.id === lessonId);
      
      if (lessonIndex === -1) {
        throw new Error('Lesson not found');
      }
      
      // Create updated quiz
      const quizId = lessons[lessonIndex].quiz?.id || crypto.randomUUID();
      const updatedQuiz = {
        id: quizId,
        title: quizData.title || `${lessons[lessonIndex].title} Quiz`,
        description: quizData.description || 'Test your knowledge of this lesson',
        timeLimit: quizData.timeLimit || 10,
        passingScore: quizData.passingScore || 70,
        shuffleQuestions: quizData.shuffleQuestions || false,
        shuffleOptions: quizData.shuffleOptions || false,
        showFeedback: quizData.showFeedback !== false, // Default true
        allowReview: quizData.allowReview !== false, // Default true
        attemptsAllowed: quizData.attemptsAllowed || 0, // 0 = unlimited
        isEnabled: quizData.isEnabled !== false, // Default true
        questions: processedQuestions,
        updatedAt: serverTimestamp()
      };
      
      // Update the lesson with the new quiz
      const updatedLessons = [...lessons];
      updatedLessons[lessonIndex] = {
        ...updatedLessons[lessonIndex],
        quiz: updatedQuiz
      };
      
      // Update course document
      await updateDoc(courseRef, {
        lessons: updatedLessons,
        updatedAt: serverTimestamp()
      });
      
      console.log(`Quiz for lesson ${lessonId} updated successfully`);
      
      return {
        success: true,
        quizId,
        message: 'Quiz updated successfully'
      };
    } catch (error) {
      console.error('Error creating/updating lesson quiz:', error);
      throw error;
    }
  }

  // Create or update a final exam
  async createOrUpdateFinalExam(courseId, examData) {
    try {
      console.log(`Creating/updating final exam for course ${courseId}`);
      
      // Input validation
      if (!examData.questions || !Array.isArray(examData.questions)) {
        throw new Error('Invalid exam data: questions must be an array');
      }
      
      // Process questions (same as quiz questions)
      const processedQuestions = examData.questions.map(question => {
        // Common question properties
        const baseQuestion = {
          id: question.id || crypto.randomUUID(),
          text: question.text || '',
          type: question.type || 'multiple-choice',
          points: question.points || 1,
          explanation: question.explanation || ''
        };
        
        // Process based on question type
        switch (question.type) {
          case 'multiple-choice':
            if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
              throw new Error('Multiple choice questions must have at least 2 options');
            }
            if (question.correctAnswer === undefined || question.correctAnswer === null) {
              throw new Error('Multiple choice questions must specify a correctAnswer');
            }
            return {
              ...baseQuestion,
              options: question.options.map((option, index) => ({
                id: option.id || `option-${index}`,
                text: option.text || ''
              })),
              correctAnswer: question.correctAnswer
            };
            
          case 'true-false':
            return {
              ...baseQuestion,
              correctAnswer: !!question.correctAnswer // Ensure boolean
            };
            
          case 'multiple-answer':
            if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
              throw new Error('Multiple answer questions must have at least 2 options');
            }
            if (!question.correctAnswers || !Array.isArray(question.correctAnswers)) {
              throw new Error('Multiple answer questions must specify correctAnswers array');
            }
            return {
              ...baseQuestion,
              options: question.options.map((option, index) => ({
                id: option.id || `option-${index}`,
                text: option.text || ''
              })),
              correctAnswers: question.correctAnswers
            };
            
          case 'text':
            if (!question.correctAnswers || !Array.isArray(question.correctAnswers)) {
              throw new Error('Text questions must specify correctAnswers array');
            }
            return {
              ...baseQuestion,
              correctAnswers: question.correctAnswers,
              caseSensitive: question.caseSensitive || false
            };
            
          case 'matching':
            if (!question.pairs || !Array.isArray(question.pairs) || question.pairs.length < 2) {
              throw new Error('Matching questions must have at least 2 pairs');
            }
            return {
              ...baseQuestion,
              pairs: question.pairs.map((pair, index) => ({
                id: pair.id || `pair-${index}`,
                left: pair.left || '',
                right: pair.right || ''
              }))
            };
            
          default:
            throw new Error(`Unsupported question type: ${question.type}`);
        }
      });
      
      // Get the course document
      const courseRef = doc(db, 'Courses', courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (!courseDoc.exists()) {
        throw new Error('Course not found');
      }
      
      const courseData = courseDoc.data();
      
      // Create updated exam
      const examId = courseData.finalExam?.id || crypto.randomUUID();
      const updatedExam = {
        id: examId,
        title: examData.title || `${courseData.title} Final Exam`,
        description: examData.description || 'Comprehensive test covering all course material',
        timeLimit: examData.timeLimit || 30,
        passingScore: examData.passingScore || 70,
        shuffleQuestions: examData.shuffleQuestions || false,
        shuffleOptions: examData.shuffleOptions || false,
        showFeedback: examData.showFeedback !== false, // Default true
        allowReview: examData.allowReview !== false, // Default true
        attemptsAllowed: examData.attemptsAllowed || 3, // Default 3
        requireAllLessonsCompleted: examData.requireAllLessonsCompleted !== false, // Default true
        isEnabled: examData.isEnabled !== false, // Default true
        questions: processedQuestions,
        updatedAt: serverTimestamp()
      };
      
      // Update course document
      await updateDoc(courseRef, {
        finalExam: updatedExam,
        updatedAt: serverTimestamp()
      });
      
      console.log(`Final exam for course ${courseId} updated successfully`);
      
      return {
        success: true,
        examId,
        message: 'Final exam updated successfully'
      };
    } catch (error) {
      console.error('Error creating/updating final exam:', error);
      throw error;
    }
  }

  // Get quiz information for a lesson (student version - no correct answers)
  async getLessonQuiz(courseId, lessonId) {
    try {
      console.log(`Getting quiz for lesson ${lessonId} in course ${courseId}`);
      
      // Get course
      const courseDoc = await getDoc(doc(db, 'Courses', courseId));
      
      if (!courseDoc.exists()) {
        throw new Error('Course not found');
      }
      
      const courseData = courseDoc.data();
      const lessons = courseData.lessons || [];
      
      // Find the lesson
      const lesson = lessons.find(l => l.id === lessonId);
      
      if (!lesson) {
        throw new Error('Lesson not found');
      }
      
      const quiz = lesson.quiz;
      
      if (!quiz || !quiz.questions || quiz.questions.length === 0) {
        return { 
          exists: false,
          message: 'No quiz available for this lesson'
        };
      }
      
      if (!quiz.isEnabled) {
        return {
          exists: true,
          isEnabled: false,
          message: 'Quiz is currently disabled'
        };
      }
      
      // Get user progress information
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const userId = currentUser.uid;
      const enrollmentId = `${userId}_${courseId}`;
      const enrollmentDoc = await getDoc(doc(db, 'Enrollments', enrollmentId));
      
      if (!enrollmentDoc.exists()) {
        throw new Error('User not enrolled in this course');
      }
      
      const enrollmentData = enrollmentDoc.data();
      const lessonProgress = enrollmentData.lessonProgress || [];
      const lessonProgressItem = lessonProgress.find(p => p.lessonId === lessonId) || {};
      
      // Check if there are attempt limits
      const userAttempts = lessonProgressItem.quizAttempts || [];
      const attemptsAllowed = quiz.attemptsAllowed || 0;
      const attemptsRemaining = attemptsAllowed === 0 ? null : Math.max(0, attemptsAllowed - userAttempts.length);
      
      // Create student version of the quiz (without correct answers)
      const studentQuiz = {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        timeLimit: quiz.timeLimit,
        passingScore: quiz.passingScore,
        attemptsAllowed: quiz.attemptsAllowed,
        attemptsRemaining: attemptsRemaining,
        attemptsUsed: userAttempts.length,
        showFeedback: quiz.showFeedback,
        allowReview: quiz.allowReview,
        isCompleted: lessonProgressItem.quizCompleted || false,
        bestScore: lessonProgressItem.quizBestScore || 0,
        lastAttemptDate: lessonProgressItem.quizLastAttemptDate,
        // Remove correct answer information from questions
        questions: quiz.questions.map(question => {
          const { correctAnswer, correctAnswers, pairs, ...questionWithoutAnswers } = question;
          
          // For matching questions, randomize the right column
          if (question.type === 'matching') {
            const rightItems = pairs.map(pair => ({
              id: pair.id,
              text: pair.right
            }));
            
            // Fisher-Yates shuffle
            for (let i = rightItems.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [rightItems[i], rightItems[j]] = [rightItems[j], rightItems[i]];
            }
            
            return {
              ...questionWithoutAnswers,
              leftItems: pairs.map(pair => ({
                id: pair.id,
                text: pair.left
              })),
              rightItems
            };
          }
          
          return questionWithoutAnswers;
        })
      };
      
      return {
        exists: true,
        isEnabled: true,
        quiz: studentQuiz
      };
    } catch (error) {
      console.error('Error getting lesson quiz:', error);
      throw error;
    }
  }

  // Get final exam information (student version - no correct answers)
  async getFinalExam(courseId) {
    try {
      console.log(`Getting final exam for course ${courseId}`);
      
      // Get course
      const courseDoc = await getDoc(doc(db, 'Courses', courseId));
      
      if (!courseDoc.exists()) {
        throw new Error('Course not found');
      }
      
      const courseData = courseDoc.data();
      const exam = courseData.finalExam;
      
      if (!exam || !exam.questions || exam.questions.length === 0) {
        return { 
          exists: false,
          message: 'No final exam available for this course'
        };
      }
      
      if (!exam.isEnabled) {
        return {
          exists: true,
          isEnabled: false,
          message: 'Final exam is currently disabled'
        };
      }
      
      // Get user progress information
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const userId = currentUser.uid;
      const enrollmentId = `${userId}_${courseId}`;
      const enrollmentDoc = await getDoc(doc(db, 'Enrollments', enrollmentId));
      
      if (!enrollmentDoc.exists()) {
        throw new Error('User not enrolled in this course');
      }
      
      const enrollmentData = enrollmentDoc.data();
      
      // Check if all lessons need to be completed first
      if (exam.requireAllLessonsCompleted) {
        const lessonProgress = enrollmentData.lessonProgress || [];
        const allLessonsCompleted = lessonProgress.every(lesson => lesson.completed);
        
        if (!allLessonsCompleted) {
          return {
            exists: true,
            isEnabled: true,
            canTake: false,
            message: 'You need to complete all lessons before taking the final exam'
          };
        }
      }
      
      // Check if there are attempt limits
      const userAttempts = enrollmentData.examAttempts || [];
      const attemptsAllowed = exam.attemptsAllowed || 0;
      const attemptsRemaining = attemptsAllowed === 0 ? null : Math.max(0, attemptsAllowed - userAttempts.length);
      
      if (attemptsAllowed > 0 && userAttempts.length >= attemptsAllowed) {
        return {
          exists: true,
          isEnabled: true,
          canTake: false,
          message: 'You have used all your attempts for this exam',
          bestScore: enrollmentData.examBestScore || 0,
          isCompleted: enrollmentData.examCompleted || false,
          attemptHistory: userAttempts
        };
      }
      
      // Create student version of the exam (without correct answers)
      const studentExam = {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        timeLimit: exam.timeLimit,
        passingScore: exam.passingScore,
        attemptsAllowed: exam.attemptsAllowed,
        attemptsRemaining: attemptsRemaining,
        attemptsUsed: userAttempts.length,
        showFeedback: exam.showFeedback,
        allowReview: exam.allowReview,
        isCompleted: enrollmentData.examCompleted || false,
        bestScore: enrollmentData.examBestScore || 0,
        lastAttemptDate: enrollmentData.examLastAttemptDate,
        // Remove correct answer information from questions
        questions: exam.questions.map(question => {
          const { correctAnswer, correctAnswers, pairs, ...questionWithoutAnswers } = question;
          
          // For matching questions, randomize the right column
          if (question.type === 'matching') {
            const rightItems = pairs.map(pair => ({
              id: pair.id,
              text: pair.right
            }));
            
            // Fisher-Yates shuffle
            for (let i = rightItems.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [rightItems[i], rightItems[j]] = [rightItems[j], rightItems[i]];
            }
            
            return {
              ...questionWithoutAnswers,
              leftItems: pairs.map(pair => ({
                id: pair.id,
                text: pair.left
              })),
              rightItems
            };
          }
          
          return questionWithoutAnswers;
        })
      };
      
      return {
        exists: true,
        isEnabled: true,
        canTake: true,
        exam: studentExam
      };
    } catch (error) {
      console.error('Error getting final exam:', error);
      throw error;
    }
  }

  // Submit a quiz attempt
  async submitQuizAttempt(courseId, lessonId, quizId, answers) {
    try {
      console.log(`Submitting quiz attempt for lesson ${lessonId} in course ${courseId}`);
      
      // Validate current user
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const userId = currentUser.uid;
      
      // Validate course and lesson
      const courseDoc = await getDoc(doc(db, 'Courses', courseId));
      
      if (!courseDoc.exists()) {
        throw new Error('Course not found');
      }
      
      const courseData = courseDoc.data();
      const lessons = courseData.lessons || [];
      const lesson = lessons.find(l => l.id === lessonId);
      
      if (!lesson) {
        throw new Error('Lesson not found');
      }
      
      const quiz = lesson.quiz;
      
      if (!quiz || quiz.id !== quizId) {
        throw new Error('Quiz not found');
      }
      
      // Verify enrollment
      const enrollmentId = `${userId}_${courseId}`;
      const enrollmentRef = doc(db, 'Enrollments', enrollmentId);
      const enrollmentDoc = await getDoc(enrollmentRef);
      
      if (!enrollmentDoc.exists()) {
        throw new Error('User not enrolled in this course');
      }
      
      const enrollmentData = enrollmentDoc.data();
      const lessonProgress = enrollmentData.lessonProgress || [];
      const lessonIndex = lessonProgress.findIndex(p => p.lessonId === lessonId);
      
      if (lessonIndex === -1) {
        throw new Error('Lesson progress not found');
      }
      
      // Check attempt limits
      const attemptsAllowed = quiz.attemptsAllowed || 0;
      const currentAttempts = lessonProgress[lessonIndex].quizAttempts || [];
      
      if (attemptsAllowed > 0 && currentAttempts.length >= attemptsAllowed) {
        throw new Error('You have used all your attempts for this quiz');
      }
      
      // Grade the quiz
      const questions = quiz.questions || [];
      let totalPoints = 0;
      let earnedPoints = 0;
      const questionResults = [];
      
      questions.forEach(question => {
        const points = question.points || 1;
        totalPoints += points;
        const userAnswer = answers[question.id];
        
        if (userAnswer === undefined) {
          // Question not answered
          questionResults.push({
            questionId: question.id,
            correct: false,
            points: 0,
            possiblePoints: points,
            userAnswer: null
          });
          return;
        }
        
        let isCorrect = false;
        
        switch (question.type) {
          case 'multiple-choice':
            isCorrect = userAnswer === question.correctAnswer;
            break;
            
          case 'true-false':
            isCorrect = userAnswer === question.correctAnswer;
            break;
            
          case 'multiple-answer':
            // All correct options must be selected and no incorrect ones
            if (Array.isArray(userAnswer) && Array.isArray(question.correctAnswers)) {
              const correctSet = new Set(question.correctAnswers);
              const userSet = new Set(userAnswer);
              
              // Check if user selected all correct answers
              const allCorrectSelected = question.correctAnswers.every(answer => userSet.has(answer));
              // Check if user only selected correct answers
              const onlyCorrectSelected = userAnswer.every(answer => correctSet.has(answer));
              
              isCorrect = allCorrectSelected && onlyCorrectSelected;
            }
            break;
            
          case 'text':
            if (question.caseSensitive) {
              isCorrect = question.correctAnswers.includes(userAnswer);
            } else {
              isCorrect = question.correctAnswers
                .some(answer => answer.toLowerCase() === userAnswer.toLowerCase());
            }
            break;
            
          case 'matching':
            if (typeof userAnswer === 'object') {
              // Check if all pairs match correctly
              isCorrect = Object.entries(userAnswer).every(([leftId, rightId]) => {
                const correctPair = question.pairs.find(pair => pair.id === leftId);
                return correctPair && correctPair.id === rightId;
              });
            }
            break;
        }
        
        const pointsEarned = isCorrect ? points : 0;
        earnedPoints += pointsEarned;
        
        questionResults.push({
          questionId: question.id,
          correct: isCorrect,
          points: pointsEarned,
          possiblePoints: points,
          userAnswer
        });
      });
      
      // Calculate score
      const scorePercentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      const passed = scorePercentage >= quiz.passingScore;
      
      // Record the attempt
      const attemptId = crypto.randomUUID();
      const attemptData = {
        id: attemptId,
        quizId,
        timestamp: Timestamp.now(),
        score: scorePercentage,
        passed,
        totalPoints,
        earnedPoints,
        questions: questionResults,
        timeSpent: 0, // This could be calculated if start time was tracked
        attemptNumber: currentAttempts.length + 1
      };
      
      // Update enrollment with new quiz attempt
      const updatedLessonProgress = [...lessonProgress];
      const quizAttempts = [...currentAttempts, attemptData];
      
      // Find the best score across all attempts
      const bestScore = Math.max(
        lessonProgress[lessonIndex].quizBestScore || 0,
        scorePercentage
      );
      
      // Update lesson progress
      updatedLessonProgress[lessonIndex] = {
        ...updatedLessonProgress[lessonIndex],
        quizAttempts,
        quizCompleted: passed || updatedLessonProgress[lessonIndex].quizCompleted,
        quizBestScore: bestScore,
        quizLastAttemptDate: serverTimestamp()
      };
      
      // Update enrollment
      await updateDoc(enrollmentRef, {
        lessonProgress: updatedLessonProgress,
        lastAccessed: serverTimestamp()
      });
      
      // Calculate new overall course progress
      const newProgress = this.calculateCourseProgress(updatedLessonProgress);
      await updateDoc(enrollmentRef, {
        progress: newProgress.overallProgress
      });
      
      // Store detailed attempt data in QuizAttempts collection
      await setDoc(doc(db, 'QuizAttempts', attemptId), {
        userId,
        courseId,
        lessonId,
        quizId,
        ...attemptData,
        createdAt: serverTimestamp()
      });
      
      console.log(`Quiz attempt submitted with score ${scorePercentage}%`);
      
      return {
        success: true,
        attemptId,
        score: scorePercentage,
        passed,
        totalPoints,
        earnedPoints,
        questionResults,
        showFeedback: quiz.showFeedback,
        passingScore: quiz.passingScore
      };
    } catch (error) {
      console.error('Error submitting quiz attempt:', error);
      throw error;
    }
  }

  // Submit a final exam attempt
  async submitExamAttempt(courseId, examId, answers) {
    try {
      console.log(`Submitting exam attempt for course ${courseId}`);
      
      // Validate current user
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const userId = currentUser.uid;
      
      // Validate course and exam
      const courseDoc = await getDoc(doc(db, 'Courses', courseId));
      
      if (!courseDoc.exists()) {
        throw new Error('Course not found');
      }
      
      const courseData = courseDoc.data();
      const exam = courseData.finalExam;
      
      if (!exam || exam.id !== examId) {
        throw new Error('Exam not found');
      }
      
      // Verify enrollment
      const enrollmentId = `${userId}_${courseId}`;
      const enrollmentRef = doc(db, 'Enrollments', enrollmentId);
      const enrollmentDoc = await getDoc(enrollmentRef);
      
      if (!enrollmentDoc.exists()) {
        throw new Error('User not enrolled in this course');
      }
      
      const enrollmentData = enrollmentDoc.data();
      
      // Check if all lessons need to be completed first
      if (exam.requireAllLessonsCompleted) {
        const lessonProgress = enrollmentData.lessonProgress || [];
        const allLessonsCompleted = lessonProgress.every(lesson => lesson.completed);
        
        if (!allLessonsCompleted) {
          throw new Error('You need to complete all lessons before taking the final exam');
        }
      }
      
      // Check attempt limits
      const attemptsAllowed = exam.attemptsAllowed || 0;
      const currentAttempts = enrollmentData.examAttempts || [];
      
      if (attemptsAllowed > 0 && currentAttempts.length >= attemptsAllowed) {
        throw new Error('You have used all your attempts for this exam');
      }
      
      // Grade the exam
      const questions = exam.questions || [];
      let totalPoints = 0;
      let earnedPoints = 0;
      const questionResults = [];
      
      questions.forEach(question => {
        const points = question.points || 1;
        totalPoints += points;
        const userAnswer = answers[question.id];
        
        if (userAnswer === undefined) {
          // Question not answered
          questionResults.push({
            questionId: question.id,
            correct: false,
            points: 0,
            possiblePoints: points,
            userAnswer: null
          });
          return;
        }
        
        let isCorrect = false;
        
        switch (question.type) {
          case 'multiple-choice':
            isCorrect = userAnswer === question.correctAnswer;
            break;
            
          case 'true-false':
            isCorrect = userAnswer === question.correctAnswer;
            break;
            
          case 'multiple-answer':
            // All correct options must be selected and no incorrect ones
            if (Array.isArray(userAnswer) && Array.isArray(question.correctAnswers)) {
              const correctSet = new Set(question.correctAnswers);
              const userSet = new Set(userAnswer);
              
              // Check if user selected all correct answers
              const allCorrectSelected = question.correctAnswers.every(answer => userSet.has(answer));
              // Check if user only selected correct answers
              const onlyCorrectSelected = userAnswer.every(answer => correctSet.has(answer));
              
              isCorrect = allCorrectSelected && onlyCorrectSelected;
            }
            break;
            
          case 'text':
            if (question.caseSensitive) {
              isCorrect = question.correctAnswers.includes(userAnswer);
            } else {
              isCorrect = question.correctAnswers
                .some(answer => answer.toLowerCase() === userAnswer.toLowerCase());
            }
            break;
            
          case 'matching':
            if (typeof userAnswer === 'object') {
              // Check if all pairs match correctly
              isCorrect = Object.entries(userAnswer).every(([leftId, rightId]) => {
                const correctPair = question.pairs.find(pair => pair.id === leftId);
                return correctPair && correctPair.id === rightId;
              });
            }
            break;
        }
        
        const pointsEarned = isCorrect ? points : 0;
        earnedPoints += pointsEarned;
        
        questionResults.push({
          questionId: question.id,
          correct: isCorrect,
          points: pointsEarned,
          possiblePoints: points,
          userAnswer
        });
      });
      
      // Calculate score
      const scorePercentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      const passed = scorePercentage >= exam.passingScore;
      
      // Record the attempt
      const attemptId = crypto.randomUUID();
      const attemptData = {
        id: attemptId,
        examId,
        timestamp: Timestamp.now(),
        score: scorePercentage,
        passed,
        totalPoints,
        earnedPoints,
        questions: questionResults,
        timeSpent: 0, // This could be calculated if start time was tracked
        attemptNumber: currentAttempts.length + 1
      };
      
      // Update enrollment with new exam attempt
      const examAttempts = [...currentAttempts, attemptData];
      
      // Find the best score across all attempts
      const bestScore = Math.max(
        enrollmentData.examBestScore || 0,
        scorePercentage
      );
      
      // Update enrollment
      await updateDoc(enrollmentRef, {
        examAttempts,
        examCompleted: passed || enrollmentData.examCompleted,
        examBestScore: bestScore,
        examLastAttemptDate: serverTimestamp(),
        lastAccessed: serverTimestamp()
      });
      
      // Store detailed attempt data in ExamAttempts collection
      await setDoc(doc(db, 'ExamAttempts', attemptId), {
        userId,
        courseId,
        examId,
        ...attemptData,
        createdAt: serverTimestamp()
      });
      
      // If exam is passed and was required for course completion, check course completion
      if (passed && !enrollmentData.examCompleted) {
        // Check if all lessons are completed
        const lessonProgress = enrollmentData.lessonProgress || [];
        const allLessonsCompleted = lessonProgress.every(lesson => lesson.completed);
        
        if (allLessonsCompleted) {
          // Mark course as completed
          await this.handleCourseCompletion(userId, courseId);
        }
      }
      
      console.log(`Exam attempt submitted with score ${scorePercentage}%`);
      
      return {
        success: true,
        attemptId,
        score: scorePercentage,
        passed,
        totalPoints,
        earnedPoints,
        questionResults,
        showFeedback: exam.showFeedback,
        passingScore: exam.passingScore
      };
    } catch (error) {
      console.error('Error submitting exam attempt:', error);
      throw error;
    }
  }

  // Get quiz attempt history for a lesson
  async getQuizAttemptHistory(courseId, lessonId) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const userId = currentUser.uid;
      
      // Query quiz attempts
      const attemptsQuery = query(
        collection(db, 'QuizAttempts'),
        where('userId', '==', userId),
        where('courseId', '==', courseId),
        where('lessonId', '==', lessonId),
        orderBy('createdAt', 'desc')
      );
      
      const attemptsSnapshot = await getDocs(attemptsQuery);
      
      return attemptsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || null,
          createdAt: data.createdAt?.toDate() || null
        };
      });
    } catch (error) {
      console.error('Error getting quiz attempt history:', error);
      throw error;
    }
  }

  // Get exam attempt history
  async getExamAttemptHistory(courseId) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const userId = currentUser.uid;
      
      // Query exam attempts
      const attemptsQuery = query(
        collection(db, 'ExamAttempts'),
        where('userId', '==', userId),
        where('courseId', '==', courseId),
        orderBy('createdAt', 'desc')
      );
      
      const attemptsSnapshot = await getDocs(attemptsQuery);
      
      return attemptsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || null,
          createdAt: data.createdAt?.toDate() || null
        };
      });
    } catch (error) {
      console.error('Error getting exam attempt history:', error);
      throw error;
    }
  }

  // Get a specific quiz attempt (includes detailed results)
  async getQuizAttempt(attemptId) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const userId = currentUser.uid;
      
      // Get attempt
      const attemptDoc = await getDoc(doc(db, 'QuizAttempts', attemptId));
      
      if (!attemptDoc.exists()) {
        throw new Error('Attempt not found');
      }
      
      const attemptData = attemptDoc.data();
      
      // Verify this is the user's attempt
      if (attemptData.userId !== userId) {
        throw new Error('Unauthorized access to attempt');
      }
      
      // Get quiz details for reference
      try {
        const courseDoc = await getDoc(doc(db, 'Courses', attemptData.courseId));
        
        if (courseDoc.exists()) {
          const courseData = courseDoc.data();
          const lessons = courseData.lessons || [];
          const lesson = lessons.find(l => l.id === attemptData.lessonId);
          
          if (lesson && lesson.quiz) {
            const quiz = lesson.quiz;
            
            // Enhance attempt with question text and correct answers if allowed to review
            if (quiz.allowReview) {
              const questionLookup = {};
              quiz.questions.forEach(question => {
                questionLookup[question.id] = question;
              });
              
              // Add question details to the results
              attemptData.questions = attemptData.questions.map(result => {
                const questionDetails = questionLookup[result.questionId];
                
                if (questionDetails) {
                  return {
                    ...result,
                    text: questionDetails.text,
                    type: questionDetails.type,
                    correctAnswer: questionDetails.correctAnswer,
                    correctAnswers: questionDetails.correctAnswers,
                    options: questionDetails.options,
                    pairs: questionDetails.pairs,
                    explanation: questionDetails.explanation
                  };
                }
                
                return result;
              });
            }
          }
        }
      } catch (error) {
        console.warn('Error retrieving additional quiz details:', error);
      }
      
      return {
        ...attemptData,
        timestamp: attemptData.timestamp?.toDate() || null,
        createdAt: attemptData.createdAt?.toDate() || null
      };
    } catch (error) {
      console.error('Error getting quiz attempt:', error);
      throw error;
    }
  }

  // Get a specific exam attempt (includes detailed results)
  async getExamAttempt(attemptId) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const userId = currentUser.uid;
      
      // Get attempt
      const attemptDoc = await getDoc(doc(db, 'ExamAttempts', attemptId));
      
      if (!attemptDoc.exists()) {
        throw new Error('Attempt not found');
      }
      
      const attemptData = attemptDoc.data();
      
      // Verify this is the user's attempt
      if (attemptData.userId !== userId) {
        throw new Error('Unauthorized access to attempt');
      }
      
      // Get exam details for reference
      try {
        const courseDoc = await getDoc(doc(db, 'Courses', attemptData.courseId));
        
        if (courseDoc.exists()) {
          const courseData = courseDoc.data();
          const exam = courseData.finalExam;
          
          if (exam) {
            // Enhance attempt with question text and correct answers if allowed to review
            if (exam.allowReview) {
              const questionLookup = {};
              exam.questions.forEach(question => {
                questionLookup[question.id] = question;
              });
              
              // Add question details to the results
              attemptData.questions = attemptData.questions.map(result => {
                const questionDetails = questionLookup[result.questionId];
                
                if (questionDetails) {
                  return {
                    ...result,
                    text: questionDetails.text,
                    type: questionDetails.type,
                    correctAnswer: questionDetails.correctAnswer,
                    correctAnswers: questionDetails.correctAnswers,
                    options: questionDetails.options,
                    pairs: questionDetails.pairs,
                    explanation: questionDetails.explanation
                  };
                }
                
                return result;
              });
            }
          }
        }
      } catch (error) {
        console.warn('Error retrieving additional exam details:', error);
      }
      
      return {
        ...attemptData,
        timestamp: attemptData.timestamp?.toDate() || null,
        createdAt: attemptData.createdAt?.toDate() || null
      };
    } catch (error) {
      console.error('Error getting exam attempt:', error);
      throw error;
    }
  }

  // Get quiz analytics for a given quiz (admin function)
  async getQuizAnalytics(courseId, lessonId) {
    try {
      // Get quiz attempts
      const attemptsQuery = query(
        collection(db, 'QuizAttempts'),
        where('courseId', '==', courseId),
        where('lessonId', '==', lessonId)
      );
      
      const attemptsSnapshot = await getDocs(attemptsQuery);
      
      if (attemptsSnapshot.empty) {
        return {
          totalAttempts: 0,
          averageScore: 0,
          passRate: 0,
          questionAnalytics: []
        };
      }
      
      const attempts = attemptsSnapshot.docs.map(doc => doc.data());
      
      // Get quiz details
      const courseDoc = await getDoc(doc(db, 'Courses', courseId));
      
      if (!courseDoc.exists()) {
        throw new Error('Course not found');
      }
      
      const courseData = courseDoc.data();
      const lessons = courseData.lessons || [];
      const lesson = lessons.find(l => l.id === lessonId);
      
      if (!lesson || !lesson.quiz) {
        throw new Error('Quiz not found');
      }
      
      const quiz = lesson.quiz;
      
      // Basic statistics
      const totalAttempts = attempts.length;
      const totalScores = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
      const averageScore = totalAttempts > 0 ? Math.round(totalScores / totalAttempts) : 0;
      const passCount = attempts.filter(attempt => attempt.passed).length;
      const passRate = totalAttempts > 0 ? Math.round((passCount / totalAttempts) * 100) : 0;
      
      // Question-level analytics
      const questionAnalytics = [];
      
      quiz.questions.forEach(question => {
        const questionId = question.id;
        let totalCorrect = 0;
        let totalAttempted = 0;
        
        attempts.forEach(attempt => {
          const questionResult = attempt.questions.find(q => q.questionId === questionId);
          
          if (questionResult) {
            totalAttempted++;
            if (questionResult.correct) {
              totalCorrect++;
            }
          }
        });
        
        const correctRate = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
        
        questionAnalytics.push({
          questionId,
          text: question.text,
          type: question.type,
          totalAttempted,
          totalCorrect,
          correctRate
        });
      });
      
      // Sort questions by difficulty (lowest correct rate first)
      questionAnalytics.sort((a, b) => a.correctRate - b.correctRate);
      
      return {
        totalAttempts,
        averageScore,
        passRate,
        questionAnalytics
      };
    } catch (error) {
      console.error('Error getting quiz analytics:', error);
      throw error;
    }
  }

  // Get exam analytics (admin function)
  async getExamAnalytics(courseId) {
    try {
      // Get exam attempts
      const attemptsQuery = query(
        collection(db, 'ExamAttempts'),
        where('courseId', '==', courseId)
      );
      
      const attemptsSnapshot = await getDocs(attemptsQuery);
      
      if (attemptsSnapshot.empty) {
        return {
          totalAttempts: 0,
          averageScore: 0,
          passRate: 0,
          questionAnalytics: []
        };
      }
      
      const attempts = attemptsSnapshot.docs.map(doc => doc.data());
      
      // Get exam details
      const courseDoc = await getDoc(doc(db, 'Courses', courseId));
      
      if (!courseDoc.exists()) {
        throw new Error('Course not found');
      }
      
      const courseData = courseDoc.data();
      const exam = courseData.finalExam;
      
      if (!exam) {
        throw new Error('Exam not found');
      }
      
      // Basic statistics
      const totalAttempts = attempts.length;
      const totalScores = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
      const averageScore = totalAttempts > 0 ? Math.round(totalScores / totalAttempts) : 0;
      const passCount = attempts.filter(attempt => attempt.passed).length;
      const passRate = totalAttempts > 0 ? Math.round((passCount / totalAttempts) * 100) : 0;
      
      // Question-level analytics
      const questionAnalytics = [];
      
      exam.questions.forEach(question => {
        const questionId = question.id;
        let totalCorrect = 0;
        let totalAttempted = 0;
        
        attempts.forEach(attempt => {
          const questionResult = attempt.questions.find(q => q.questionId === questionId);
          
          if (questionResult) {
            totalAttempted++;
            if (questionResult.correct) {
              totalCorrect++;
            }
          }
        });
        
        const correctRate = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
        
        questionAnalytics.push({
          questionId,
          text: question.text,
          type: question.type,
          totalAttempted,
          totalCorrect,
          correctRate
        });
      });
      
      // Sort questions by difficulty (lowest correct rate first)
      questionAnalytics.sort((a, b) => a.correctRate - b.correctRate);
      
      return {
        totalAttempts,
        averageScore,
        passRate,
        questionAnalytics
      };
    } catch (error) {
      console.error('Error getting exam analytics:', error);
      throw error;
    }
  }
}

export default new CourseService();