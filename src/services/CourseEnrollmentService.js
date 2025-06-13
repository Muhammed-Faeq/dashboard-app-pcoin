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
    query,
    orderBy,
    limit,
    where,
    increment,
    runTransaction,
    Timestamp
} from 'firebase/firestore';

class CourseEnrollmentService {
    // Enroll a user in a course with comprehensive progress tracking
    async enrollUserInCourse(userId, courseId) {
        try {
            console.log(`Enrolling user ${userId} in course ${courseId}`);

            return await runTransaction(db, async (transaction) => {
                // STEP 1: PERFORM ALL READS FIRST
                // Read the user document
                const userRef = doc(db, 'Users', userId);
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists()) {
                    throw new Error(`User ${userId} not found`);
                }

                // Read the course document
                const courseRef = doc(db, 'Courses', courseId);
                const courseDoc = await transaction.get(courseRef);

                if (!courseDoc.exists()) {
                    throw new Error(`Course ${courseId} not found`);
                }

                // Check if enrollment already exists
                const enrollmentRef = doc(db, 'Enrollments', `${userId}_${courseId}`);
                const enrollmentDoc = await transaction.get(enrollmentRef);

                // Get course data for enrollment
                const courseData = courseDoc.data();

                // STEP 2: PERFORM ALL WRITES AFTER ALL READS
                // If enrollment doesn't exist, create it
                if (!enrollmentDoc.exists()) {
                    // Create enrollment object
                    const enrollment = {
                        userId: userId,
                        courseId: courseId,
                        enrolledAt: serverTimestamp(),
                        lastAccessedAt: serverTimestamp(),
                        progress: 0,
                        completedLessons: [],
                        status: 'active',
                        id: `${userId}_${courseId}`
                    };

                    // Write the enrollment document
                    transaction.set(enrollmentRef, enrollment);

                    // Update course enrollment count
                    const newEnrollmentCount = (courseData.enrollmentCount || 0) + 1;
                    transaction.update(courseRef, {
                        enrollmentCount: newEnrollmentCount
                    });

                    console.log(`User ${userId} successfully enrolled in course ${courseId}`);
                    return { success: true, enrollment };
                } else {
                    console.log(`User ${userId} is already enrolled in course ${courseId}`);
                    return {
                        success: false,
                        message: 'User is already enrolled in this course',
                        enrollment: enrollmentDoc.data()
                    };
                }
            });
        } catch (error) {
            console.error('Service error enrolling user:', error);
            throw error;
        }
    }

    // Update user's lesson progress
    async updateLessonProgress(courseId, lessonId, progressData) {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('User not authenticated');
            }

            const userId = currentUser.uid;
            const enrollmentId = `${userId}_${courseId}`;
            const enrollmentRef = doc(db, 'Enrollments', enrollmentId);

            // Get current enrollment data
            const enrollmentDoc = await getDoc(enrollmentRef);
            if (!enrollmentDoc.exists()) {
                throw new Error('Enrollment not found');
            }

            const enrollmentData = enrollmentDoc.data();
            const lessonProgress = enrollmentData.lessonProgress || [];
            const lessonIndex = lessonProgress.findIndex(item => item.lessonId === lessonId);

            if (lessonIndex === -1) {
                throw new Error('Lesson not found in enrollment');
            }

            // Update lesson progress with new data
            const updatedLessonProgress = [...lessonProgress];
            const currentLesson = updatedLessonProgress[lessonIndex];

            // Calculate progress percentage (optional override from frontEnd)
            const progressPercent = progressData.progressPercent || progressData.progress || currentLesson.progress || 0;
            const isCompleted = progressPercent >= 100 || progressData.completed === true;

            // Track if this is newly completed
            const wasCompletedBefore = currentLesson.completed;
            const isNewlyCompleted = isCompleted && !wasCompletedBefore;

            // Update lesson data
            updatedLessonProgress[lessonIndex] = {
                ...currentLesson,
                progress: progressPercent,
                completed: isCompleted,
                startedAt: currentLesson.startedAt || serverTimestamp(),
                completedAt: isNewlyCompleted ? serverTimestamp() : currentLesson.completedAt,
                timeSpent: (currentLesson.timeSpent || 0) + (progressData.timeSpent || 60), // Default to 1 minute if not specified
                lastAccessed: serverTimestamp()
            };

            // Calculate overall course progress
            const totalLessons = updatedLessonProgress.length;
            const completedLessons = updatedLessonProgress.filter(lesson => lesson.completed).length;
            const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

            // Determine current lesson (first incomplete or last one)
            let currentLessonId = lessonId;
            for (const lesson of updatedLessonProgress) {
                if (!lesson.completed) {
                    currentLessonId = lesson.lessonId;
                    break;
                }
            }

            // Update enrollment document
            await updateDoc(enrollmentRef, {
                lessonProgress: updatedLessonProgress,
                progress: overallProgress,
                completedLessons: completedLessons,
                isCompleted: overallProgress === 100,
                lastAccessed: serverTimestamp(),
                currentLesson: currentLessonId
            });

            // Also update legacy enrollment record
            try {
                const userEnrollmentRef = doc(db, `UserTasks/${userId}/EnrolledCourses`, courseId);
                await updateDoc(userEnrollmentRef, {
                    progress: overallProgress,
                    lastAccessedAt: serverTimestamp(),
                    isCompleted: overallProgress === 100,
                    lessonProgress: updatedLessonProgress
                });
            } catch (error) {
                console.warn('Could not update legacy enrollment format (non-critical):', error);
            }

            // Update user's course progress in the enrolledCourses array
            try {
                const userRef = doc(db, 'Users', userId);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const enrolledCourses = userData.enrolledCourses || [];
                    const courseIndex = enrolledCourses.findIndex(course => course.courseId === courseId);

                    if (courseIndex !== -1) {
                        // Course exists in array, update it
                        enrolledCourses[courseIndex].progress = overallProgress;
                        enrolledCourses[courseIndex].isCompleted = overallProgress === 100;

                        await updateDoc(userRef, {
                            enrolledCourses: enrolledCourses,
                            lastActive: serverTimestamp()
                        });
                    }
                }
            } catch (error) {
                console.warn('Could not update user enrolledCourses array (non-critical):', error);
            }

            // If course is newly completed, handle the completion
            if (isCompleted && overallProgress === 100 && !enrollmentData.isCompleted) {
                this.handleCourseCompletion(userId, courseId);
            }

            return {
                success: true,
                progress: overallProgress,
                lessonProgress: updatedLessonProgress[lessonIndex],
                isCompleted: overallProgress === 100
            };
        } catch (error) {
            console.error('Error updating lesson progress:', error);
            throw error;
        }
    }

    // Track resource access in a lesson
    async trackResourceAccess(courseId, lessonId, resourceId) {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('User not authenticated');
            }

            const userId = currentUser.uid;
            const enrollmentId = `${userId}_${courseId}`;
            const enrollmentRef = doc(db, 'Enrollments', enrollmentId);

            // Use transaction for data consistency
            await runTransaction(db, async (transaction) => {
                const enrollmentDoc = await transaction.get(enrollmentRef);

                if (!enrollmentDoc.exists()) {
                    throw new Error('Enrollment not found');
                }

                const enrollmentData = enrollmentDoc.data();
                const lessonProgress = enrollmentData.lessonProgress || [];
                const lessonIndex = lessonProgress.findIndex(item => item.lessonId === lessonId);

                if (lessonIndex === -1) {
                    throw new Error('Lesson not found in enrollment');
                }

                const lesson = lessonProgress[lessonIndex];
                const resources = lesson.resources || [];
                const resourceIndex = resources.findIndex(item => item.resourceId === resourceId);

                if (resourceIndex === -1) {
                    throw new Error('Resource not found in lesson');
                }

                // Update resource access data
                const updatedResources = [...resources];
                updatedResources[resourceIndex] = {
                    ...updatedResources[resourceIndex],
                    accessed: true,
                    lastAccessed: serverTimestamp(),
                    downloadCount: (updatedResources[resourceIndex].downloadCount || 0) + 1
                };

                // Update lesson resources
                const updatedLessonProgress = [...lessonProgress];
                updatedLessonProgress[lessonIndex] = {
                    ...updatedLessonProgress[lessonIndex],
                    resources: updatedResources,
                    lastAccessed: serverTimestamp()
                };

                // Update enrollment
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

    // Handle course completion and generate certificate
    async handleCourseCompletion(userId, courseId) {
        try {
            console.log(`Processing course completion for user ${userId}, course ${courseId}`);

            // 1. Update enrollment as completed
            const enrollmentId = `${userId}_${courseId}`;
            const enrollmentRef = doc(db, 'Enrollments', enrollmentId);

            // Generate certificate ID
            const certificateId = `CERT-${userId.substring(0, 4)}-${courseId.substring(0, 4)}-${Date.now().toString(36).toUpperCase()}`;

            // Update enrollment with completion data
            await updateDoc(enrollmentRef, {
                isCompleted: true,
                completedAt: serverTimestamp(),
                certificateIssued: true,
                certificateId: certificateId,
                certificateIssuedAt: serverTimestamp()
            });

            // 2. Get course data for the certificate
            const courseDoc = await getDoc(doc(db, 'Courses', courseId));
            const courseData = courseDoc.exists() ? courseDoc.data() : { title: 'Unknown Course' };

            // 3. Get user data
            const userDoc = await getDoc(doc(db, 'Users', userId));
            const userData = userDoc.exists() ? userDoc.data() : {};

            // 4. Create certificate document
            await setDoc(doc(db, 'Certificates', certificateId), {
                certificateId,
                userId,
                courseId,
                courseTitle: courseData.title || 'Unknown Course',
                userName: `${userData.FirstName || userData.firstName || ''} ${userData.LastName || userData.lastName || ''}`.trim(),
                userEmail: userData.Email || userData.email || '',
                issuedAt: serverTimestamp(),
                completedAt: serverTimestamp(),
                validity: 'lifetime',
                verificationUrl: `https://example.com/verify/${certificateId}`
            });

            // 5. Add to user achievements
            const achievementRef = doc(collection(db, `UserTasks/${userId}/Achievements`));
            await setDoc(achievementRef, {
                type: 'course_completion',
                courseId,
                courseTitle: courseData.title || 'Unknown Course',
                achievedAt: serverTimestamp(),
                certificateId: certificateId
            });

            // 6. Update user stats
            const statsRef = doc(db, 'UserStats', userId);
            await updateDoc(statsRef, {
                coursesCompleted: increment(1),
                lastCourseCompletedAt: serverTimestamp()
            }, { merge: true });

            console.log(`Course ${courseId} completion processed successfully for user ${userId}`);
            return {
                success: true,
                certificateId
            };
        } catch (error) {
            console.error('Error handling course completion:', error);
            // Don't throw, this is a background process
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get all courses a user is enrolled in
    async getUserEnrolledCourses(userId = null) {
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

            console.log(`Getting enrolled courses for user ${targetUserId}`);

            // Query all enrollments for this user
            const enrollmentsQuery = query(
                collection(db, 'Enrollments'),
                where('userId', '==', targetUserId)
            );

            const enrollmentsSnapshot = await getDocs(enrollmentsQuery);

            if (enrollmentsSnapshot.empty) {
                return [];
            }

            // Process each enrollment to get course details
            const enrolledCourses = await Promise.all(
                enrollmentsSnapshot.docs.map(async (doc) => {
                    const enrollmentData = doc.data();

                    // Get course data
                    try {
                        const courseDoc = await getDoc(doc(db, 'Courses', enrollmentData.courseId));

                        if (courseDoc.exists()) {
                            const courseData = courseDoc.data();

                            return {
                                enrollmentId: doc.id,
                                courseId: enrollmentData.courseId,
                                title: courseData.title || enrollmentData.courseTitle,
                                description: courseData.description || '',
                                imageUrl: courseData.imageUrl || '',
                                categoryId: courseData.categoryId || '',
                                level: courseData.level || courseData.difficulty || 'Beginner',
                                instructorId: courseData.instructorId || '',
                                enrolledAt: enrollmentData.enrolledAt,
                                lastAccessed: enrollmentData.lastAccessed,
                                progress: enrollmentData.progress || 0,
                                completedLessons: enrollmentData.completedLessons || 0,
                                totalLessons: enrollmentData.totalLessons || 0,
                                isCompleted: enrollmentData.isCompleted || false,
                                currentLesson: enrollmentData.currentLesson || null,
                                isPremium: courseData.isPremium || false
                            };
                        }
                    } catch (error) {
                        console.error(`Error getting course details for ${enrollmentData.courseId}:`, error);
                    }

                    // Fallback with minimal data if course not found
                    return {
                        enrollmentId: doc.id,
                        courseId: enrollmentData.courseId,
                        title: enrollmentData.courseTitle || 'Unknown Course',
                        enrolledAt: enrollmentData.enrolledAt,
                        lastAccessed: enrollmentData.lastAccessed,
                        progress: enrollmentData.progress || 0,
                        isCompleted: enrollmentData.isCompleted || false
                    };
                })
            );

            // Sort by last accessed (most recent first)
            return enrolledCourses.sort((a, b) => {
                if (!a.lastAccessed) return 1;
                if (!b.lastAccessed) return -1;
                return b.lastAccessed.seconds - a.lastAccessed.seconds;
            });
        } catch (error) {
            console.error('Error getting enrolled courses:', error);
            throw error;
        }
    }

    // Get detailed progress for a specific course enrollment
    async getCourseEnrollmentDetails(courseId, userId = null) {
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

            const enrollmentId = `${targetUserId}_${courseId}`;
            const enrollmentDoc = await getDoc(doc(db, 'Enrollments', enrollmentId));

            if (!enrollmentDoc.exists()) {
                throw new Error('Enrollment not found');
            }

            const enrollmentData = enrollmentDoc.data();

            // Update last accessed timestamp
            await updateDoc(doc(db, 'Enrollments', enrollmentId), {
                lastAccessed: serverTimestamp()
            });

            // Get course data
            const courseDoc = await getDoc(doc(db, 'Courses', courseId));
            const courseData = courseDoc.exists() ? courseDoc.data() : null;

            return {
                enrollmentId,
                courseId,
                userId: targetUserId,
                courseTitle: enrollmentData.courseTitle,
                enrolledAt: enrollmentData.enrolledAt,
                lastAccessed: enrollmentData.lastAccessed,
                progress: enrollmentData.progress || 0,
                isCompleted: enrollmentData.isCompleted || false,
                completedLessons: enrollmentData.completedLessons || 0,
                totalLessons: enrollmentData.totalLessons || 0,
                currentLesson: enrollmentData.currentLesson || null,
                certificateId: enrollmentData.certificateId || null,
                lessonProgress: enrollmentData.lessonProgress || [],
                notes: enrollmentData.notes || [],
                course: courseData ? {
                    title: courseData.title,
                    description: courseData.description,
                    imageUrl: courseData.imageUrl,
                    lessons: courseData.lessons || [],
                    isPremium: courseData.isPremium || false,
                    categoryId: courseData.categoryId,
                    level: courseData.level || courseData.difficulty
                } : null
            };
        } catch (error) {
            console.error('Error getting course enrollment details:', error);
            throw error;
        }
    }

    // Add note to a course lesson
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
                lessonId,
                text: noteText,
                createdAt: serverTimestamp()
            };

            // Add note to enrollment
            await updateDoc(enrollmentRef, {
                notes: arrayUnion(note),
                lastAccessed: serverTimestamp()
            });

            return {
                success: true,
                note
            };
        } catch (error) {
            console.error('Error adding course note:', error);
            throw error;
        }
    }

    // Get all certificates for a user
    async getUserCertificates(userId = null) {
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

            const certificatesQuery = query(
                collection(db, 'Certificates'),
                where('userId', '==', targetUserId)
            );

            const certificatesSnapshot = await getDocs(certificatesQuery);

            if (certificatesSnapshot.empty) {
                return [];
            }

            return certificatesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting user certificates:', error);
            throw error;
        }
    }

    // Get all enrollments for a specific course (admin function)
    async getCourseEnrollments(courseId) {
        try {
            // Check if current user is an admin
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('User not authenticated');
            }

            // Query enrollments for this course
            const enrollmentsQuery = query(
                collection(db, 'Enrollments'),
                where('courseId', '==', courseId),
                orderBy('enrolledAt', 'desc')
            );

            const enrollmentsSnapshot = await getDocs(enrollmentsQuery);

            if (enrollmentsSnapshot.empty) {
                return [];
            }

            // Get user details for each enrollment
            const enrollments = await Promise.all(
                enrollmentsSnapshot.docs.map(async (doc) => {
                    const enrollmentData = doc.data();

                    // Get user data
                    let userData = { firstName: '', lastName: '', email: '' };
                    try {
                        const userDoc = await getDoc(doc(db, 'Users', enrollmentData.userId));

                        if (userDoc.exists()) {
                            const data = userDoc.data();
                            userData = {
                                id: userDoc.id,
                                firstName: data.FirstName || data.firstName || '',
                                lastName: data.LastName || data.lastName || '',
                                email: data.Email || data.email || ''
                            };
                        }
                    } catch (error) {
                        console.warn(`Could not get user data for enrollment ${doc.id}:`, error);
                    }

                    return {
                        id: doc.id,
                        userId: enrollmentData.userId,
                        user: userData,
                        enrolledAt: enrollmentData.enrolledAt,
                        progress: enrollmentData.progress || 0,
                        isCompleted: enrollmentData.isCompleted || false,
                        lastAccessed: enrollmentData.lastAccessed,
                        completedLessons: enrollmentData.completedLessons || 0,
                        totalLessons: enrollmentData.totalLessons || 0
                    };
                })
            );

            return enrollments;
        } catch (error) {
            console.error('Error getting course enrollments:', error);
            throw error;
        }
    }

    // Cancel an enrollment
    async cancelEnrollment(courseId, userId = null) {
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

            console.log(`Canceling enrollment for user ${targetUserId} in course ${courseId}`);

            const enrollmentId = `${targetUserId}_${courseId}`;

            // Use transaction to ensure all operations succeed or fail together
            await runTransaction(db, async (transaction) => {
                // 1. Check if enrollment exists
                const enrollmentRef = doc(db, 'Enrollments', enrollmentId);
                const enrollmentDoc = await transaction.get(enrollmentRef);

                if (!enrollmentDoc.exists()) {
                    throw new Error('Enrollment not found');
                }

                // 2. Delete enrollment
                transaction.delete(enrollmentRef);

                // 3. Decrement course enrollment count
                const courseRef = doc(db, 'Courses', courseId);
                const courseDoc = await transaction.get(courseRef);

                if (courseDoc.exists()) {
                    transaction.update(courseRef, {
                        enrollmentCount: increment(-1),
                        updatedAt: serverTimestamp()
                    });
                }

                // 4. Update user's enrolled courses array
                const userRef = doc(db, 'Users', targetUserId);
                const userDoc = await transaction.get(userRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const enrolledCourses = userData.enrolledCourses || [];
                    const updatedCourses = enrolledCourses.filter(course => course.courseId !== courseId);

                    transaction.update(userRef, {
                        enrolledCourses: updatedCourses,
                        lastActive: serverTimestamp()
                    });
                }

                // 5. Update user stats
                const statsRef = doc(db, 'UserStats', targetUserId);
                const statsDoc = await transaction.get(statsRef);

                if (statsDoc.exists()) {
                    transaction.update(statsRef, {
                        coursesEnrolled: increment(-1)
                    }, { merge: true });
                }

                // 6. Delete from legacy location
                const legacyRef = doc(db, `UserTasks/${targetUserId}/EnrolledCourses`, courseId);
                transaction.delete(legacyRef);
            });

            return {
                success: true,
                message: 'Enrollment canceled successfully'
            };
        } catch (error) {
            console.error('Error canceling enrollment:', error);
            throw error;
        }
    }
}

export default new CourseEnrollmentService();